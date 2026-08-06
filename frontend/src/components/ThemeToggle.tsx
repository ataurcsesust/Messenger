import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemeMode } from "../context/ThemeContext";

interface ThemeToggleProps {
  variant?: "compact" | "segmented";
  className?: string;
}

export function ThemeToggle({ variant = "compact", className = "" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === "segmented") {
    const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
      { mode: "light", label: "Light", icon: Sun },
      { mode: "dark", label: "Dark", icon: Moon },
      { mode: "system", label: "System", icon: Monitor },
    ];

    return (
      <div
        role="radiogroup"
        aria-label="Theme selection"
        className={`flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 ${className}`}
      >
        {options.map(({ mode, label, icon: Icon }) => {
          const isSelected = theme === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${label} theme mode`}
              onClick={() => setTheme(mode)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isSelected
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Compact header toggle button
  const getIcon = () => {
    if (theme === "system") {
      return <Monitor className="h-4.5 w-4.5 text-blue-500 dark:text-blue-400" />;
    }
    return resolvedTheme === "dark" ? (
      <Moon className="h-4.5 w-4.5 text-indigo-400" />
    ) : (
      <Sun className="h-4.5 w-4.5 text-amber-500" />
    );
  };

  const getTooltip = () => {
    if (theme === "system") return "Theme: System (click to switch to Light)";
    if (theme === "light") return "Theme: Light (click to switch to Dark)";
    return "Theme: Dark (click to switch to System)";
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${className}`}
      title={getTooltip()}
      aria-label={getTooltip()}
    >
      {getIcon()}
    </button>
  );
}
