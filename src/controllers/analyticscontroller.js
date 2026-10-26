import mongoose from "mongoose";
import Event from "../models/eventmodel.js";
import Exhibitor from "../models/exhibitormodel.js";
import Attendee from "../models/attendeemodel.js";
import Session from "../models/sessionmodel.js";
import Booth from "../models/boothmodel.js";
import BoothVisit from "../models/boothvisitmodel.js";

async function getExpoAnalytics(req, res) {
  try {
    const eventId = req.query.eventId ?? "";

    if (
      typeof eventId !== "string" ||
      (eventId && !mongoose.isObjectIdOrHexString(eventId))
    ) {
      return res.status(400).json({ msg: "Invalid event ID" });
    }

    const eventFilter =
      req.user.role === "admin"
        ? {}
        : { organizer: req.user._id };

    const events = await Event.find(eventFilter)
      .select("title")
      .sort({ title: 1 })
      .lean();

    const selectedEvents = eventId
      ? events.filter((event) => event._id.toString() === eventId)
      : events;

    if (eventId && selectedEvents.length === 0) {
      return res.status(403).json({
        msg: "You do not have access to this event",
      });
    }

    const filter = {
      event: {
        $in: selectedEvents.map((event) => event._id),
      },
    };

    const [
      attendeeRegistrations,
      applications,
      booths,
      sessions,
      visitResults,
    ] = await Promise.all([
      Attendee.countDocuments(filter),
      Exhibitor.find(filter)
        .select("companyName event boothNumber status")
        .lean(),
      Booth.find(filter).select("status").lean(),
      Session.find(filter)
        .select("title event +registeredUsers +bookmarkedBy")
        .lean(),
      BoothVisit.aggregate([
        { $match: filter },
        {
          $facet: {
            exhibitors: [
              {
                $group: {
                  _id: "$exhibitor",
                  visits: { $sum: 1 },
                },
              },
            ],
            visitors: [
              { $group: { _id: "$attendee" } },
              { $count: "total" },
            ],
          },
        },
      ]),
    ]);

    const eventNames = new Map(
      events.map((event) => [event._id.toString(), event.title])
    );

    const sessionStats = sessions.map((session) => ({
      id: session._id,
      title: session.title,
      eventTitle: eventNames.get(session.event.toString()) || "",
      registrations: session.registeredUsers?.length || 0,
      bookmarks: session.bookmarkedBy?.length || 0,
    }));

    sessionStats.sort(
      (first, second) =>
        second.registrations - first.registrations ||
        second.bookmarks - first.bookmarks ||
        first.title.localeCompare(second.title)
    );

    const visitSummary = visitResults[0] || {
      exhibitors: [],
      visitors: [],
    };

    const visitCounts = new Map(
      visitSummary.exhibitors.map((item) => [
        item._id.toString(),
        item.visits,
      ])
    );

    const exhibitorStats = applications
      .map((application) => ({
        id: application._id,
        companyName: application.companyName,
        eventTitle:
          eventNames.get(application.event.toString()) || "",
        boothNumber: application.boothNumber || "",
        status: application.status,
        visits: visitCounts.get(application._id.toString()) || 0,
      }))
      .filter((item) => item.status === "Approved" || item.visits > 0)
      .sort(
        (first, second) =>
          second.visits - first.visits ||
          first.companyName.localeCompare(second.companyName)
      );

    const reservedBooths = booths.filter(
      (booth) => booth.status === "Reserved"
    ).length;

    const analytics = {
      totalEvents: selectedEvents.length,
      attendeeRegistrations,
      exhibitorApplications: applications.length,
      approvedApplications: applications.filter(
        (item) => item.status === "Approved"
      ).length,
      pendingApplications: applications.filter(
        (item) => item.status === "Pending"
      ).length,
      rejectedApplications: applications.filter(
        (item) => item.status === "Rejected"
      ).length,
      totalBooths: booths.length,
      reservedBooths,
      availableBooths: booths.filter(
        (booth) => booth.status === "Available"
      ).length,
      boothReservationRate: booths.length
        ? Math.round((reservedBooths / booths.length) * 100)
        : 0,
      totalSessions: sessions.length,
      sessionRegistrations: sessionStats.reduce(
        (total, session) => total + session.registrations,
        0
      ),
      sessionBookmarks: sessionStats.reduce(
        (total, session) => total + session.bookmarks,
        0
      ),
      recordedBoothVisits: visitSummary.exhibitors.reduce(
        (total, item) => total + item.visits,
        0
      ),
      uniqueVisitingAttendees: visitSummary.visitors[0]?.total || 0,
    };

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      selectedEventId: eventId,
      events,
      analytics,
      sessionStats,
      exhibitorStats,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to load analytics",
    });
  }
}

export { getExpoAnalytics };