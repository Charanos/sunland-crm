import { redirect } from "next/navigation";
import {
  financeSectionById,
  isFinanceTab,
  type FinanceSectionId,
} from "@/components/finance/finance-config";

export function assertFinanceTab(sectionId: FinanceSectionId, tabId: string) {
  if (!isFinanceTab(sectionId, tabId)) {
    redirect(financeSectionById[sectionId].href);
  }
}
