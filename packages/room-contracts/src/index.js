function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateRoomSummary(value) {
  const errors = [];

  if (!isObject(value)) {
    return {
      ok: false,
      errors: ["room summary must be an object"],
    };
  }

  if ("room_key" in value && typeof value.room_key !== "string") {
    errors.push("room_key must be a string");
  }

  if ("room" in value && typeof value.room !== "string") {
    errors.push("room must be a string");
  }

  if ("status" in value && typeof value.status !== "string") {
    errors.push("status must be a string");
  }

  if ("summary" in value && typeof value.summary !== "string") {
    errors.push("summary must be a string");
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, errors: [], value };
}
