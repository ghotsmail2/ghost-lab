export function csvCell(value, { untrustedText = false } = {}) {
  let text = String(value ?? '')
  if (untrustedText && /^[\u0000-\u0020\uFEFF]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
