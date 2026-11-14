import AnimatedGenerateButton from "@/components/ui/animated-generate-button-shadcn-tailwind";

export default function DemoOne() {
  return <AnimatedGenerateButton
  labelIdle="Generate"
  labelActive="Building"
  highlightHueDeg={5000}
/>;
}
