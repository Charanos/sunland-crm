import { FinanceQrProof } from "@/components/finance/finance-qr-proof";
import { IconShieldCheck, IconLock } from "@tabler/icons-react";

export default async function FinanceReportTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 animate-fade-in pt-8 pb-16">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="size-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm mb-2">
          <IconShieldCheck size={32} stroke={1.5} />
        </div>
        <h1 className="title-serif tracking-tight text-slate-900">
          Document Authentication Portal
        </h1>
        <p className="max-w-2xl leading-relaxed text-slate-500 font-light headline-md">
          You are accessing the Sunland Group secure verification registry. 
          The document associated with this token has been cryptographically signed 
          and its authenticity can be verified against our immutable ledger.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
        <div className="p-1">
          <FinanceQrProof
            artifactRef={token.includes("chq_") ? `CHQ-${token.split("_").pop()}` : "TRX-VERIFIED"}
            artifactType={token.includes("credited") ? "Cheque Credit Receipt" : token.includes("returned") ? "Returned Cheque Notice" : "Secure Financial Artifact"}
            entityName="Sunland Group"
            generatedAt={new Date().toISOString().split("T")[0]}
            token={token}
            amount={token.includes("chq") ? undefined : 0}
            compact={false}
          />
        </div>
        
        <div className="bg-slate-50/80 border-t border-slate-100 p-5 flex items-center justify-center gap-2 text-sm text-slate-500">
          <IconLock size={16} />
          <span>Secured by Sunland Group Enterprise Cryptography</span>
        </div>
      </div>
    </div>
  );
}
