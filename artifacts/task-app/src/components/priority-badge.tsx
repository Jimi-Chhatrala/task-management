import { Badge } from "@/components/ui/badge";

const priorityStyles: Record<string, string> = {
  lowest: "bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  low: "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  medium: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  high: "bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  highest: "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
};

export function PriorityBadge({ priority }: { priority: string }) {
  const className = priorityStyles[priority] || priorityStyles.lowest;
  return (
    <Badge variant="outline" className={`font-medium shadow-sm ${className} capitalize`}>
      {priority}
    </Badge>
  );
}
