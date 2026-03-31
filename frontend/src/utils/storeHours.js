const DEFAULT_BUSINESS_TIME_ZONE = 'America/Toronto';

const getTimeFormatter = (timeZone = DEFAULT_BUSINESS_TIME_ZONE) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

const normalizeTime = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }

  return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
};

const toMinutes = (value) => {
  const normalized = normalizeTime(value);
  if (!normalized) {
    return null;
  }

  const [hours, minutes] = normalized.split(':').map(Number);
  return (hours * 60) + minutes;
};

const isTimeWithinRange = (time, open, close) => {
  const currentMinutes = toMinutes(time);
  const openMinutes = toMinutes(open);
  const closeMinutes = toMinutes(close);

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

export const getCurrentBusinessTime = (
  date = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE
) => getTimeFormatter(timeZone).format(date);

export const isStoreOpenNow = (
  storeHours,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
  date = new Date()
) => {
  if (!storeHours?.open || !storeHours?.close) {
    return null;
  }

  return isTimeWithinRange(getCurrentBusinessTime(date, timeZone), storeHours.open, storeHours.close);
};
