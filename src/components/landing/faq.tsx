import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Is this legal advice?",
    a: "No. PlainTerms provides educational information to help you understand contract language. It is not a substitute for professional legal advice. Always consult a qualified solicitor or attorney for specific legal matters.",
  },
  {
    q: "What types of contracts can I analyse?",
    a: "We support a wide range of consumer contracts including insurance policies, rental and tenancy agreements, gym memberships, cloud service terms, mobile phone contracts, employment agreements, and more.",
  },
  {
    q: "Do you store my documents?",
    a: "No. Your contract text is processed in real-time and is not stored on our servers. We take your privacy seriously.",
  },
  {
    q: "What do I get for free?",
    a: "The free preview shows the overall verdict and 2\u20133 key findings from your contract. The full report with all clause breakdowns, action items, and letter templates requires a one-off payment or subscription.",
  },
  {
    q: "How accurate is the analysis?",
    a: "Our AI is trained to identify common contract patterns and risks. While it catches most standard issues, it may not identify every nuance. We recommend using it as a starting point for understanding your contract, alongside professional advice for important decisions.",
  },
];

export function FAQ() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-2xl px-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Frequently asked questions
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-10">
          {FAQS.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-sm font-medium sm:text-base">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
