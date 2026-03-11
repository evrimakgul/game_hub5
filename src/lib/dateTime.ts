export function formatDateDayMonthYear(date: Date): string {
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
}

export function formatTimeHoursMinutes(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function formatActualDateTime(date: Date): string {
  return `${formatDateDayMonthYear(date)} - ${formatTimeHoursMinutes(date)}`;
}
