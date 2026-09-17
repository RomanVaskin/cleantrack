const moscowDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Moscow',
})

const moscowTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Moscow',
})

function formatTimestamp(value: string, formatter: Intl.DateTimeFormat): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : formatter.format(date)
}

export function formatCleaningDateTime(value: string): string {
  return formatTimestamp(value, moscowDateTimeFormatter)
}

export function formatCleaningTime(value: string): string {
  return formatTimestamp(value, moscowTimeFormatter)
}
