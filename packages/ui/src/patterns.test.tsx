import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./segmented-control";
import { FilterChip, AppliedFilters } from "./filter-chip";
import { Stepper } from "./stepper";
import { Timeline } from "./timeline";
import { EmptyState } from "./empty-state";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "./sheet";

afterEach(cleanup);

describe("Patrones de interfaz", () => {
  it("SegmentedControl renderiza un grupo con una selección y responde al teclado", async () => {
    function Example() {
      const [value, setValue] = React.useState("day");
      return <SegmentedControl label="Vista" value={value} onValueChange={setValue} options={[{ value: "day", label: "Día" }, { value: "week", label: "Semana" }]} />;
    }
    render(<Example />);
    expect(screen.getByRole("radiogroup", { name: "Vista" })).toBeTruthy();
    expect((screen.getByRole("radio", { name: "Día" }) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole("radio", { name: "Semana" }));
    expect((screen.getByRole("radio", { name: "Semana" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "Día" }) as HTMLInputElement).checked).toBe(false);
  });
  it("FilterChip usa aria-pressed y comunica el siguiente estado", () => {
    const change = vi.fn();
    render(<FilterChip pressed onPressedChange={change}>Online</FilterChip>);
    const chip = screen.getByRole("button", { name: "Online", pressed: true });
    fireEvent.click(chip); expect(change).toHaveBeenCalledWith(false);
  });
  it("AppliedFilters anuncia resultados, permite quitar y limpiar", () => {
    const remove = vi.fn(), clear = vi.fn();
    render(<AppliedFilters filters={[{ id: "online", label: "Online" }]} onRemove={remove} onClear={clear} count={2} />);
    expect(screen.getByRole("status").textContent).toBe("2 resultados");
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtro Online" }));
    expect(remove).toHaveBeenCalledWith("online");
    fireEvent.click(screen.getByRole("button", { name: "Limpiar todo" })); expect(clear).toHaveBeenCalledOnce();
  });
  it("Stepper marca solo el paso actual y conserva los estados", () => {
    render(<Stepper steps={["Servicio", "Fecha", "Hora"]} currentStep={1} />);
    const steps = screen.getAllByRole("listitem");
    expect(steps[0]?.getAttribute("data-state")).toBe("completed");
    expect(steps[1]?.getAttribute("aria-current")).toBe("step");
    expect(steps[2]?.getAttribute("data-state")).toBe("pending");
    expect(document.querySelectorAll('[aria-current="step"]').length).toBe(1);
  });
  it("Timeline escala duración, anuncia ahora y expone bloques y huecos como botones", () => {
    const block = vi.fn(), free = vi.fn();
    render(<Timeline label="Agenda del día" startMinute={540} endMinute={720} pixelsPerMinute={2}
      blocks={[{ id: "a", startMinute: 600, endMinute: 660, label: "Ana, consulta", content: "Ana" }]}
      freeRanges={[{ startMinute: 540, endMinute: 600 }]} nowMinute={570} onBlockClick={block} onFreeClick={free} />);
    const appointment = screen.getByRole("button", { name: "Ana, consulta" });
    expect(appointment.style.height).toBe("120px"); expect(appointment.style.top).toBe("120px");
    expect(screen.getByRole("img", { name: "Ahora 09:30" })).toBeTruthy();
    fireEvent.click(appointment); expect(block).toHaveBeenCalledWith("a");
    fireEvent.click(screen.getByRole("button", { name: "Libre 09:00–10:00" }));
    expect(free).toHaveBeenCalledWith({ startMinute: 540, endMinute: 600 });
  });
  it("EmptyState tiene título accesible y acción", () => {
    render(<EmptyState title="Sin citas" description="Comparte tu página." action={<button>Compartir</button>} />);
    expect(screen.getByRole("region", { name: "Sin citas" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compartir" })).toBeTruthy();
  });
  it("Sheet inferior conserva nombre, descripción, foco y cierre", async () => {
    render(<Sheet><SheetTrigger>Ver cita</SheetTrigger><SheetContent side="bottom"><SheetTitle>Ana</SheetTitle><SheetDescription>Consulta online</SheetDescription></SheetContent></Sheet>);
    await userEvent.click(screen.getByRole("button", { name: "Ver cita" }));
    const dialog = screen.getByRole("dialog", { name: "Ana" });
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ver cita" }));
  });
});
