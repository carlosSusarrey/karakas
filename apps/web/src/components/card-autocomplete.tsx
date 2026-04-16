"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDebounce } from "@/hooks/use-debounce";

interface CardSuggestion {
  name: string;
  imageUrl: string | null;
}

interface CardAutocompleteProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  commanderOnly?: boolean;
  showPreview?: boolean;
  className?: string;
  disabled?: boolean;
}

export function CardAutocomplete({
  id,
  name,
  value,
  onChange,
  placeholder,
  commanderOnly = false,
  showPreview = true,
  className = "",
  disabled = false,
}: CardAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<CardSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [hoveredIndex, setHoveredIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedValue = useDebounce(value, 300);

  // Fetch suggestions when debounced value changes
  useEffect(() => {
    if (debouncedValue.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ q: debouncedValue });
        if (commanderOnly) {
          params.set("commander", "true");
        }

        const response = await fetch(`/api/cards/autocomplete?${params}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
          setIsOpen(data.suggestions?.length > 0);
        }
      } catch (error) {
        console.error("Failed to fetch card suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedValue, commanderOnly]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = useCallback(
    (suggestion: CardSuggestion) => {
      onChange(suggestion.name);
      setIsOpen(false);
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === "ArrowDown" && suggestions.length > 0) {
        setIsOpen(true);
        setHighlightedIndex(0);
        event.preventDefault();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          selectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        event.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case "Tab":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Determine which card image to show in preview
  const previewIndex = hoveredIndex >= 0 ? hoveredIndex : highlightedIndex;
  const previewCard =
    showPreview && previewIndex >= 0 ? suggestions[previewIndex] : null;

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-amber-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 flex gap-2">
          {/* Suggestions dropdown */}
          <div
            ref={dropdownRef}
            id={`${id}-listbox`}
            role="listbox"
            className="w-full min-w-[300px] max-h-60 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg"
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.name}
                role="option"
                aria-selected={highlightedIndex === index}
                className={`px-4 py-2 cursor-pointer transition-colors ${
                  highlightedIndex === index
                    ? "bg-amber-500/20 text-amber-100"
                    : "text-zinc-100 hover:bg-zinc-700"
                }`}
                onClick={() => selectSuggestion(suggestion)}
                onMouseEnter={() => {
                  setHighlightedIndex(index);
                  setHoveredIndex(index);
                }}
                onMouseLeave={() => setHoveredIndex(-1)}
              >
                {suggestion.name}
              </div>
            ))}
          </div>

          {/* Card image preview */}
          {showPreview && previewCard?.imageUrl && (
            <div className="hidden md:block flex-shrink-0">
              <img
                src={previewCard.imageUrl}
                alt={previewCard.name}
                className="w-[146px] h-auto rounded-lg shadow-lg border border-zinc-700"
                loading="eager"
              />
            </div>
          )}
        </div>
      )}

      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
