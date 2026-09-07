export function parseTimeToMinutes(input: string): number | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();

  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3];

  if (hours > 23 || minutes > 59) return null;

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}