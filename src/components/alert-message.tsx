type AlertVariant = "error" | "success" | "warning" | "info";

interface AlertMessageProps {
  variant: AlertVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<AlertVariant, string> = {
  error: "bg-red-900/50 border-red-700 text-red-200",
  success: "bg-green-900/50 border-green-700 text-green-200",
  warning: "bg-amber-900/50 border-amber-700 text-amber-200",
  info: "bg-blue-900/50 border-blue-700 text-blue-200",
};

export function AlertMessage({
  variant,
  children,
  className = "",
}: AlertMessageProps) {
  return (
    <div
      className={`border px-4 py-3 rounded-lg ${variantStyles[variant]} ${className}`}
      role={variant === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
