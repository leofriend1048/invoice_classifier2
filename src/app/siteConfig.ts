export const siteConfig = {
  name: "Invoice Tracker",
  url: "https://insights.tremor.so",
  description: "The only reporting and audit dashboard you will ever need.",
  baseLinks: {
    reports: "/reports",
    transactions: "/transactions",
    settings: {
      categorization: "/settings/categorization",
      users: "/settings/users",
    },
    login: "/login",
    onboarding: "/onboarding/products",
  },
}

export type siteConfig = typeof siteConfig
