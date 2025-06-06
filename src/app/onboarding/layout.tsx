"use client"
import { Button } from "@/components/Button"
import { Logo } from "@/components/ui/Logo"
import useScroll from "@/lib/useScroll"
import { cx } from "@/lib/utils"
import { usePathname } from "next/navigation"
import React from "react"

interface Step {
  name: string
  href: string
}

const steps: Step[] = [
  { name: "Product selection", href: "/onboarding/product" },
  { name: "Employees", href: "/onboarding/employees" },
  { name: "Infrastructure", href: "/onboarding/infrastructure" },
]

interface StepProgressProps {
  steps: Step[]
}

const StepProgress = ({ steps }: StepProgressProps) => {
  const pathname = usePathname()
  const currentStepIndex = steps.findIndex((step) =>
    pathname.startsWith(step.href),
  )

  return (
    <div aria-label="Onboarding progress">
      <ol className="mx-auto flex w-24 flex-nowrap gap-1 md:w-fit">
        {steps.map((step, index) => (
          <li
            key={step.name}
            className={cx(
              "h-1 w-12 rounded-full",
              index <= currentStepIndex
                ? "bg-blue-500"
                : "bg-gray-300 dark:bg-gray-700",
            )}
          >
            <span className="sr-only">
              {step.name}{" "}
              {index < currentStepIndex
                ? "completed"
                : index === currentStepIndex
                  ? "current"
                  : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const onboardingSteps = [
  {
    title: "Connect Your Gmail",
    illustration: null,
    content: (
      <ul className="list-disc pl-6 space-y-2">
        <li>Import invoices directly from your Gmail account.</li>
        <li>Follow the prompts to securely connect your email (one-time setup).</li>
        <li>The system will automatically pull in new invoices as they arrive.</li>
      </ul>
    ),
  },
  {
    title: "Review & Classify Invoices",
    illustration: null,
    content: (
      <ul className="list-disc pl-6 space-y-2">
        <li>All your invoices appear in a simple table with key info at a glance.</li>
        <li>Use search and filters (status, category, branch, amount) to quickly find what you need.</li>
        <li>Our AI reads each invoice and suggests category, subcategory, GL account, branch, payment method, and a clear description.</li>
        <li>The AI learns from your corrections and gets smarter over time.</li>
      </ul>
    ),
  },
  {
    title: "Edit, Approve & Track",
    illustration: null,
    content: (
      <ul className="list-disc pl-6 space-y-2">
        <li>Click any invoice to open the details drawer and review or edit any field.</li>
        <li>Approve, mark as paid, or flag for payment with a single click.</li>
        <li>Select multiple invoices for bulk actions: approve, edit, delete, or export.</li>
        <li>Every change is logged in a timeline for full transparency.</li>
        <li>Manage your list of categories, subcategories, and branches in Settings.</li>
        <li>You're always in control—review, edit, and approve as needed. The more you use it, the smarter it gets!</li>
      </ul>
    ),
  },
]

const OnboardingStepper = () => {
  const [step, setStep] = React.useState(0)
  const isLast = step === onboardingSteps.length - 1
  const isFirst = step === 0
  const { title, illustration, content } = onboardingSteps[step]

  return (
    <div className="flex flex-col items-center space-y-6">
      <h1 className="text-2xl font-bold text-center">{title}</h1>
      <div className="max-w-md text-gray-800 dark:text-gray-100">{content}</div>
      <div className="flex gap-4 mt-6">
        <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={isFirst}>
          Back
        </Button>
        {!isLast ? (
          <Button variant="primary" onClick={() => setStep(step + 1)}>
            Next
          </Button>
        ) : (
          <Button variant="primary" asChild>
            <a href="/reports">Finish</a>
          </Button>
        )}
      </div>
      <div className="flex gap-2 mt-4">
        {onboardingSteps.map((_, i) => (
          <span
            key={i}
            className={cx(
              "inline-block h-2 w-6 rounded-full transition-all",
              i === step ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-700"
            )}
          />
        ))}
      </div>
      <div className="mt-8 text-center text-blue-600 font-bold text-lg">
        Welcome aboard! Your invoice workflow just got a whole lot easier.
      </div>
    </div>
  )
}

const Layout = ({
  children,
}: Readonly<{
  children: React.ReactNode
}>) => {
  const scrolled = useScroll(15)

  return (
    <>
      <header
        className={cx(
          "fixed inset-x-0 top-0 isolate z-50 flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 transition-all md:grid md:grid-cols-[200px_auto_200px] md:px-6 dark:border-gray-900 dark:bg-gray-925",
          scrolled ? "h-12" : "h-20",
        )}
      >
        <div
          className="hidden flex-nowrap items-center gap-0.5 md:flex"
          aria-hidden="true"
        >
          <Logo
            className="w-7 p-px text-blue-500 dark:text-blue-500"
            aria-hidden="true"
          />
          <span className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-gray-50">
            Insights
          </span>
        </div>
        <StepProgress steps={steps} />
        <Button variant="ghost" className="ml-auto w-fit" asChild>
          <a href="/reports">Skip to dashboard</a>
        </Button>
      </header>
      <main id="main-content" className="mx-auto mb-20 mt-28 max-w-lg">
        <OnboardingStepper />
      </main>
    </>
  )
}

export default Layout
