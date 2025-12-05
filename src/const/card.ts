export const PillNotifyCard = (params?: Record<string, string | boolean>) => ({
  templateId: "AAqXfv48ZgpjT",
  templateVersion: "1.0.5",
  templateVariable: params
})

export const SnackCaser = (card: ReturnType<typeof PillNotifyCard>) => {
  return {
    template_id: card.templateId,
    template_version_name: card.templateVersion,
    template_variable: card.templateVariable
  }
}