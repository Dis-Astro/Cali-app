import { useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LightningRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

const LightningRating = ({ 
  value, 
  onChange, 
  readonly = false,
  size = "md" 
}: LightningRatingProps) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue !== null ? hoverValue : value;

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  };

  const gapClasses = {
    sm: "gap-0.5",
    md: "gap-1",
    lg: "gap-1.5"
  };

  const handleClick = (rating: number) => {
    if (!readonly && onChange) {
      onChange(rating);
    }
  };

  return (
    <div 
      className={cn(
        "flex items-center",
        gapClasses[size],
        readonly && "opacity-70"
      )}
      onMouseLeave={() => !readonly && setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
        <button
          key={rating}
          type="button"
          disabled={readonly}
          className={cn(
            "transition-all duration-150",
            !readonly && "cursor-pointer hover:scale-110",
            readonly && "cursor-default"
          )}
          onClick={() => handleClick(rating)}
          onMouseEnter={() => !readonly && setHoverValue(rating)}
        >
          <Zap
            className={cn(
              sizeClasses[size],
              "transition-colors duration-150",
              rating <= displayValue
                ? "text-primary fill-primary"
                : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
};

export default LightningRating;
