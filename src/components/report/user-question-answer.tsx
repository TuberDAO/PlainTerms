"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MessageCircleQuestion } from "lucide-react";

interface UserQuestionAnswerProps {
  userQuestion: string | null;
  userAnswer: string | null;
}

export function UserQuestionAnswer({
  userQuestion,
  userAnswer,
}: UserQuestionAnswerProps) {
  if (!userQuestion || !userAnswer) return null;

  return (
    <Card className="rounded-xl border-primary/20 bg-primary/[0.03]">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <MessageCircleQuestion className="h-3.5 w-3.5" />
          Your question, answered
        </div>

        <p className="mt-3 rounded-lg bg-muted/40 px-4 py-2.5 text-sm font-medium leading-relaxed">
          {userQuestion}
        </p>

        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {userAnswer}
        </p>
      </CardContent>
    </Card>
  );
}
