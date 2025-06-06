import { Label } from "@/components/Label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { useQueryState } from "nuqs"

const branchOptions = [
  { value: "Michael Todd Beauty", label: "Michael Todd Beauty" },
  { value: "NasalFresh MD", label: "NasalFresh MD" },
]

function FilterBranch() {
  const DEFAULT_BRANCH = "all"
  const [branch, setBranch] = useQueryState<string>("branch", {
    defaultValue: DEFAULT_BRANCH,
    parse: (value) =>
      [DEFAULT_BRANCH, ...branchOptions.map((b) => b.value)].includes(value)
        ? value
        : DEFAULT_BRANCH,
  })

  const handleValueChange = (value: string) => {
    setBranch(value)
  }

  return (
    <div>
      <Label htmlFor="branch-filter" className="font-medium">
        Branch
      </Label>
      <Select value={branch} onValueChange={handleValueChange}>
        <SelectTrigger id="branch-filter" className="mt-2 w-full md:w-44">
          <SelectValue placeholder="Select branch" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem key="all" value="all">
            All
          </SelectItem>
          {branchOptions.map((branch) => (
            <SelectItem key={branch.value} value={branch.value}>
              {branch.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export { FilterBranch }
