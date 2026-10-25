import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";
import { Badge } from "./badge";
import { Card, CardTitle } from "./card";
import { FormField } from "./form-field";
import { Input } from "./input";
import { Textarea } from "./textarea";
import {
  PageHeader,
  Toolbar,
  SectionHeader,
  DataList,
  DataRow,
  KPI,
} from "./layout";
import { SkeletonKPI, SkeletonRow } from "./skeleton";
import { Avatar, AvatarFallback } from "./avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Label } from "./label";
import { Switch } from "./switch";

afterEach(cleanup);

describe("Sistema visual compartido", () => {
  it("PageHeader conserva un título de nivel uno y acciones accesibles", () => {
    render(
      <PageHeader
        title="Pacientes"
        description="12 pacientes"
        actions={<Button>Agregar paciente</Button>}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Pacientes", level: 1 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Agregar paciente" }),
    ).toBeTruthy();
    expect(screen.getByText("12 pacientes")).toBeTruthy();
  });
  it("SectionHeader permite una jerarquía de títulos apropiada", () => {
    render(
      <SectionHeader
        title="Hoy"
        as="h3"
        actions={<a href="/agenda">Ver agenda</a>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Hoy", level: 3 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver agenda" })).toBeTruthy();
  });
  it("Toolbar agrupa controles con un nombre accesible", () => {
    render(
      <Toolbar label="Filtros de pacientes">
        <Input aria-label="Buscar paciente" />
        <Button>Buscar</Button>
      </Toolbar>,
    );
    expect(
      screen.getByRole("group", { name: "Filtros de pacientes" }),
    ).toBeTruthy();
  });
  it("DataList y DataRow conservan la semántica de lista y la acción de cada fila", () => {
    render(
      <DataList aria-label="Pacientes">
        <DataRow
          leading={
            <Avatar>
              <AvatarFallback>AM</AvatarFallback>
            </Avatar>
          }
          title="Ana Martínez"
          description="Última cita · ayer"
          trailing={<a href="/paciente">Abrir expediente</a>}
        />
      </DataList>,
    );
    expect(screen.getByRole("list", { name: "Pacientes" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Abrir expediente" })).toBeTruthy();
    expect(screen.getByText("Ana Martínez")).toBeTruthy();
  });
  it("KPI asocia etiqueta y dato sin perder el delta", () => {
    render(
      <KPI
        label="Consultas"
        value="24"
        delta="+4 vs. mes anterior"
        trend="up"
      />,
    );
    expect(screen.getByText("Consultas").tagName).toBe("DT");
    expect(screen.getByText("24").tagName).toBe("DD");
    expect(screen.getByText("+4 vs. mes anterior")).toBeTruthy();
  });
  it("Button anuncia carga y evita ejecutar la acción durante ella", async () => {
    render(<Button loading>Guardar</Button>);
    const button = screen.getByRole("button", {
      name: "Guardar",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });
  it("Button asChild conserva el enlace y su nombre", () => {
    render(
      <Button asChild>
        <a href="/agenda">Abrir agenda</a>
      </Button>,
    );
    expect(
      screen.getByRole("link", { name: "Abrir agenda" }).getAttribute("href"),
    ).toBe("/agenda");
  });
  it.each(["confirmed", "pending", "done", "cancelled"] as const)(
    "Badge %s conserva el estado como texto",
    (variant) => {
      render(<Badge variant={variant}>Estado de la cita</Badge>);
      expect(screen.getByText("Estado de la cita")).toBeTruthy();
    },
  );
  it("Card conserva el título de la unidad accionable", () => {
    render(
      <Card>
        <CardTitle>Consulta inicial</CardTitle>
      </Card>,
    );
    expect(
      screen.getByRole("heading", { name: "Consulta inicial", level: 3 }),
    ).toBeTruthy();
  });
  it("FormField asocia label, ayuda y error con el input", () => {
    render(
      <FormField label="Correo" error="Correo inválido">
        <Input type="email" />
      </FormField>,
    );
    const input = screen.getByRole("textbox", { name: "Correo" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(
      document.getElementById(input.getAttribute("aria-describedby") ?? "")
        ?.textContent,
    ).toBe("Correo inválido");
    expect(screen.getByRole("alert").textContent).toBe("Correo inválido");
  });
  it("FormField asocia ayuda a un área de texto", () => {
    render(
      <FormField label="Notas" hint="Opcional">
        <Textarea />
      </FormField>,
    );
    const input = screen.getByRole("textbox", { name: "Notas" });
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(
      document.getElementById(input.getAttribute("aria-describedby") ?? "")
        ?.textContent,
    ).toBe("Opcional");
  });
  it("SkeletonRow y SkeletonKPI no anuncian datos ficticios", () => {
    const { container } = render(
      <>
        <SkeletonRow />
        <SkeletonKPI />
      </>,
    );
    expect(
      container.querySelectorAll('[aria-hidden="true"]').length,
    ).toBeGreaterThan(1);
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(screen.queryByRole("term")).toBeNull();
  });
  it("Tabs conserva tablist, selección y panel asociado", async () => {
    render(
      <Tabs defaultValue="appointments">
        <TabsList aria-label="Agenda">
          <TabsTrigger value="appointments">Citas</TabsTrigger>
          <TabsTrigger value="services">Servicios</TabsTrigger>
        </TabsList>
        <TabsContent value="appointments">Citas del día</TabsContent>
        <TabsContent value="services">Lista de servicios</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole("tablist", { name: "Agenda" })).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Servicios" }));
    expect(
      screen
        .getByRole("tab", { name: "Servicios" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByRole("tabpanel", { name: "Servicios" }).textContent,
    ).toBe("Lista de servicios");
  });
  it("Dialog mantiene nombre, descripción y cierre por Escape para confirmaciones", async () => {
    render(
      <Dialog>
        <DialogTrigger>Eliminar servicio</DialogTrigger>
        <DialogContent>
          <DialogTitle>¿Eliminar servicio?</DialogTitle>
          <DialogDescription>
            El servicio dejará de mostrarse.
          </DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Eliminar servicio" });
    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "¿Eliminar servicio?" });
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it("Select tiene label visible y valor seleccionado", () => {
    render(
      <FormField label="Modalidad">
        <Select defaultValue="online">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="online">Online</SelectItem>
          </SelectContent>
        </Select>
      </FormField>,
    );
    expect(screen.getByRole("combobox", { name: "Modalidad" })).toBeTruthy();
  });
  it("Switch conserva label, rol y cambio de estado", async () => {
    render(
      <>
        <Label htmlFor="reminders">Recordatorios</Label>
        <Switch id="reminders" defaultChecked />
      </>,
    );
    const toggle = screen.getByRole("switch", { name: "Recordatorios" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    await userEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });
});
