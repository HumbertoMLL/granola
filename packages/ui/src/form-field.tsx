"use client";

import * as React from "react";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { SelectTrigger } from "./select";
import { Switch } from "./switch";
import { Label } from "./label";

function associateControls(
  nodes: React.ReactNode,
  id: string,
  description: string | undefined,
  invalid: boolean,
): React.ReactNode {
  return React.Children.map(nodes, (node) => {
    if (
      !React.isValidElement<{
        id?: string;
        children?: React.ReactNode;
        "aria-describedby"?: string;
        "aria-invalid"?: boolean;
      }>(node)
    )
      return node;
    if (
      node.type === Input ||
      node.type === Textarea ||
      node.type === SelectTrigger ||
      node.type === Switch ||
      node.type === "input" ||
      node.type === "textarea" ||
      node.type === "select"
    ) {
      return React.cloneElement(node, {
        id,
        "aria-describedby": description,
        "aria-invalid": invalid,
      });
    }
    return node.props.children
      ? React.cloneElement(node, {
          children: associateControls(
            node.props.children,
            id,
            description,
            invalid,
          ),
        })
      : node;
  });
}

/** Un control por campo. En grupos usar fieldset/legend o un radiogroup con nombre. */
export function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {associateControls(
        children,
        id,
        error || hint ? `${id}-help` : undefined,
        !!error,
      )}
      {error ? (
        <p
          id={`${id}-help`}
          role="alert"
          className="text-sm text-destructive-ink"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
