// Run with mongosh against the migrated notifications database. Every check that does not hold
// throws, so the step fails. The collections are left empty afterwards.
function refuses(what, write) {
  try {
    write();
  } catch (e) {
    print("ok   refuses " + what + " (" + (e.code || e.codeName) + ")");
    return;
  }
  throw new Error("accepted " + what);
}

function accepts(what, write) {
  write();
  print("ok   accepts " + what);
}

const now = new Date();
const notification = (id, extra) => Object.assign({
  _id: id, userId: "11111111-1111-1111-1111-111111111111", barbershopId: null,
  title: "Cita confirmada", body: "Tu cita del 10/10 a las 10:00 fue confirmada.",
  type: "APPOINTMENT_CONFIRMATION", read: false, sourceEventId: null,
  createdAt: now, updatedAt: now, createdBy: null
}, extra || {});

accepts("a valid notification", () => db.notification.insertOne(notification("n-1", { sourceEventId: "e-1" })));
accepts("two notifications without a source event", () => {
  db.notification.insertOne(notification("n-2"));
  db.notification.insertOne(notification("n-3"));
});
refuses("a second notification of the same event", () => db.notification.insertOne(notification("n-4", { sourceEventId: "e-1" })));
refuses("an unknown type", () => db.notification.insertOne(notification("n-5", { type: "LOYALTY" })));
refuses("a field outside the model", () => db.notification.insertOne(notification("n-6", { email: "x@y.z" })));
refuses("a title over 150 characters", () => db.notification.insertOne(notification("n-7", { title: "t".repeat(151) })));
refuses("a body over 500 characters", () => db.notification.insertOne(notification("n-8", { body: "b".repeat(501) })));
refuses("a notification without userId", () => {
  const n = notification("n-9");
  delete n.userId;
  db.notification.insertOne(n);
});
refuses("more than 10 delivery attempts", () => db.notification.insertOne(notification("n-10", {
  deliveryAttempts: Array.from({ length: 11 }, () => ({ channel: "PUSH", status: "FAILED", attemptedAt: now }))
})));

const device = (id, token, extra) => Object.assign({
  _id: id, userId: "11111111-1111-1111-1111-111111111111", token: token, platform: "ANDROID",
  createdAt: now, updatedAt: now
}, extra || {});
accepts("a device token", () => db.device_token.insertOne(device("d-1", "fcm-1")));
refuses("the same device token twice", () => db.device_token.insertOne(device("d-2", "fcm-1")));
refuses("an unknown platform", () => db.device_token.insertOne(device("d-3", "fcm-3", { platform: "WEB" })));

const key = (k, op) => ({ key: k, operation: op, resourceId: "d-1", requestHash: "h", createdAt: now });
accepts("an idempotency key", () => db.idempotency_key.insertOne(key("key-00000001", "POST /api/v1/device-tokens")));
accepts("the same key for another operation", () => db.idempotency_key.insertOne(key("key-00000001", "POST /other")));
refuses("the same key and operation twice", () => db.idempotency_key.insertOne(key("key-00000001", "POST /api/v1/device-tokens")));
refuses("a key shorter than 8 characters", () => db.idempotency_key.insertOne(key("short", "POST /api/v1/device-tokens")));

const processed = (id, extra) => Object.assign({ _id: id, eventType: "PasswordResetRequested", processedAt: now }, extra || {});
accepts("a processed event", () => db.processed_event.insertOne(processed("e-10")));
refuses("the same event processed twice", () => db.processed_event.insertOne(processed("e-10")));
refuses("a processed event carrying its payload", () => db.processed_event.insertOne(processed("e-11", { code: "123456" })));
refuses("a processed event of an inbox type", () => db.processed_event.insertOne(processed("e-12", { eventType: "AppointmentConfirmed" })));
refuses("a processed event without eventType", () => {
  const p = processed("e-13");
  delete p.eventType;
  db.processed_event.insertOne(p);
});
refuses("a processed event without processedAt", () => {
  const p = processed("e-14");
  delete p.processedAt;
  db.processed_event.insertOne(p);
});
refuses("a processedAt that is not a date", () => db.processed_event.insertOne(processed("e-15", { processedAt: "2026-10-08" })));
const ttl = db.processed_event.getIndexes().find((i) => i.name === "ttl_processed_event_processed_at");
if (!ttl || ttl.expireAfterSeconds !== 2592000) throw new Error("processed_event has no 30-day TTL index");
print("ok   processed_event expires after 30 days");

const roles = db.getUser("notifications_app").roles.map((r) => r.role);
if (!roles.includes("notifications_writer")) throw new Error("notifications_app lacks notifications_writer");
print("ok   notifications_app holds notifications_writer");

db.notification.deleteMany({});
db.device_token.deleteMany({});
db.idempotency_key.deleteMany({});
db.processed_event.deleteMany({});
