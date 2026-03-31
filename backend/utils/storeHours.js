const DEFAULT_BUSINESS_TIME_ZONE = 'America/Toronto';

const getFormatter = (timeZone = DEFAULT_BUSINESS_TIME_ZONE) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

const getDateTimeParts = (date = new Date(), timeZone = DEFAULT_BUSINESS_TIME_ZONE) => {
  const parts = getFormatter(timeZone).formatToParts(date);

  return parts.reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }

    return acc;
  }, {});
};

const normalizeTime = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }

  const hours = String(match[1]).padStart(2, '0');
  const minutes = match[2];
  return `${hours}:${minutes}`;
};

const timeToMinutes = (value) => {
  const normalized = normalizeTime(value);
  if (!normalized) {
    return null;
  }

  const [hours, minutes] = normalized.split(':').map(Number);
  return (hours * 60) + minutes;
};

const isTimeWithinRange = (time, open, close) => {
  const currentMinutes = timeToMinutes(time);
  const openMinutes = timeToMinutes(open);
  const closeMinutes = timeToMinutes(close);

  if (
    currentMinutes == null ||
    openMinutes == null ||
    closeMinutes == null
  ) {
    return true;
  }

  if (openMinutes <= closeMinutes) {
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }

  return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
};

const getCurrentBusinessTime = (date = new Date(), timeZone = DEFAULT_BUSINESS_TIME_ZONE) => {
  const { hour, minute } = getDateTimeParts(date, timeZone);
  return `${hour}:${minute}`;
};

const getCurrentBusinessDateTime = (date = new Date(), timeZone = DEFAULT_BUSINESS_TIME_ZONE) => {
  const { year, month, day, hour, minute, second } = getDateTimeParts(date, timeZone);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

const extractDateAndTime = (value) => {
  if (value instanceof Date) {
    return {
      date: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
      time: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:${String(value.getSeconds()).padStart(2, '0')}`
    };
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::(\d{2}))?/);

  if (!match) {
    return null;
  }

  return {
    date: match[1],
    time: `${match[2]}:${match[3] || '00'}`
  };
};

const normalizeLocalDateTime = (value) => {
  const parsed = extractDateAndTime(value);
  if (!parsed) {
    return null;
  }

  return `${parsed.date}T${parsed.time}`;
};

const isStoreOpenNow = (
  storeHours,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
  date = new Date()
) => {
  if (!storeHours || typeof storeHours !== 'object') return true;
  if (!storeHours.open || !storeHours.close) return true;

  return isTimeWithinRange(getCurrentBusinessTime(date, timeZone), storeHours.open, storeHours.close);
};

const isReservationWithinStoreHours = (reservationDate, storeHours) => {
  if (!storeHours || typeof storeHours !== 'object') return true;
  if (!storeHours.open || !storeHours.close) return true;

  const parsed = extractDateAndTime(reservationDate);
  if (!parsed) {
    return true;
  }

  return isTimeWithinRange(parsed.time, storeHours.open, storeHours.close);
};

const isFutureBusinessDateTime = (
  reservationDate,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
  now = new Date()
) => {
  const reservationDateTime = normalizeLocalDateTime(reservationDate);
  if (!reservationDateTime) {
    return false;
  }

  return reservationDateTime > getCurrentBusinessDateTime(now, timeZone);
};

module.exports = {
  DEFAULT_BUSINESS_TIME_ZONE,
  getCurrentBusinessTime,
  getCurrentBusinessDateTime,
  isTimeWithinRange,
  isStoreOpenNow,
  isReservationWithinStoreHours,
  isFutureBusinessDateTime
};
