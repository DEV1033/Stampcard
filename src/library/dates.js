export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

export const formatDay = (d) => dayFmt.format(d)
export const formatMonth = (d) => monthFmt.format(d)
export const formatStampTime = (ms) => `${dateFmt.format(ms)} at ${timeFmt.format(ms)}`