import { themeInitScript } from "@/lib/theme";

// Rendered inside <head> so the theme is set before the first paint.
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}
