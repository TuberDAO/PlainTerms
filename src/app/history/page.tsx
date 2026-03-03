import { Card, CardContent } from "@/components/ui/card";
import { FileSearch } from "lucide-react";
import { CTAButton } from "@/components/shared/cta-button";

export default function HistoryPage() {
  return (
    <div className="py-14 sm:py-20">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Report history
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your previously analysed contracts will appear here.
        </p>

        <Card className="mt-8">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <FileSearch className="h-12 w-12 text-muted-foreground/40" />
            <h2 className="mt-4 text-base font-semibold">No reports yet</h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Once you analyse a contract and sign in, your reports will be
              saved here for easy access.
            </p>
            <div className="mt-6">
              <CTAButton label="Analyse your first contract" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
