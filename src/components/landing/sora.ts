// Sora, self-hosted via next/font (no external request, no CSP issue, optimal CLS).
// The landing's display + body face. Exposed as a CSS variable so section components can opt in
// without changing the app-wide font.
import { Sora } from "next/font/google";

export const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  variable: "--font-sora",
});
