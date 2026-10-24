import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

import { cn } from "@granola/ui";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description:
    "Aviso de privacidad de Granola conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).",
};

const UPDATED = "24 de octubre de 2026";

const prose =
  "text-[15px] leading-relaxed text-foreground [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1.5 [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline [&_em]:italic";

export default function PrivacidadPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
          <p className="text-xs font-semibold tracking-wider text-primary uppercase">Legal</p>
          <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight md:text-5xl">
            Aviso de privacidad
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Última actualización: {UPDATED}</p>

          <nav aria-label="Contenido" className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm">
            <p className="font-semibold">En esta página</p>
            <ol className="mt-2 grid gap-1.5 text-muted-foreground sm:grid-cols-2">
              <li>
                <a className="hover:text-foreground" href="#granola">
                  1. Aviso de privacidad de Granola
                </a>
              </li>
              <li>
                <a className="hover:text-foreground" href="#nutriologo">
                  2. Plantilla para tu consulta
                </a>
              </li>
            </ol>
          </nav>

          {/* ------------------------------------------------------------------ */}
          <section id="granola" className={cn(prose, "mt-12")}>
            <h2>1. Aviso de privacidad integral de Granola</h2>
            <p>
              <strong>Granola</strong> (en adelante, &ldquo;Granola&rdquo; o &ldquo;nosotros&rdquo;),
              con domicilio para oír y recibir notificaciones en la Ciudad de México, México, y
              correo de contacto <a href="mailto:privacidad@granola.app">privacidad@granola.app</a>,
              es responsable del tratamiento de tus datos personales conforme a la{" "}
              <em>
                Ley Federal de Protección de Datos Personales en Posesión de los Particulares
              </em>{" "}
              (LFPDPPP), su Reglamento y los Lineamientos del Aviso de Privacidad.
            </p>

            <h3>1.1 A quién aplica</h3>
            <p>Este aviso aplica a dos tipos de titulares:</p>
            <ul>
              <li>
                <strong>Profesionales de la nutrición</strong> (&ldquo;nutriólogos&rdquo;) que crean una
                cuenta en Granola para administrar su consulta.
              </li>
              <li>
                <strong>Pacientes</strong> que agendan una cita, pagan o reciben mensajes a través
                de la página pública de un nutriólogo alojada en Granola.
              </li>
            </ul>
            <p>
              Respecto a los datos clínicos de los pacientes (expediente, mediciones, planes de
              alimentación), <strong>el nutriólogo es el responsable</strong> del tratamiento y
              Granola actúa como <strong>encargado</strong>: tratamos esos datos únicamente por
              instrucciones del nutriólogo y para prestarle el servicio.
            </p>

            <h3>1.2 Datos que recabamos</h3>
            <p>
              <strong>De nutriólogos:</strong> nombre, correo electrónico, teléfono, cédula
              profesional, fotografía, biografía y enlaces que decidas publicar; datos de
              facturación; identificadores de tus cuentas de cobro (Stripe, Mercado Pago) y de
              calendario (Google), nunca tus contraseñas de esos servicios; datos de uso de la
              plataforma.
            </p>
            <p>
              <strong>De pacientes:</strong> nombre, número de WhatsApp, correo electrónico
              (opcional), fecha de nacimiento y sexo cuando el nutriólogo los registra; datos de la
              cita (servicio, fecha, modalidad, estatus de pago); reseñas que decidas publicar.
            </p>
            <p>
              <strong>Datos personales sensibles.</strong> Los datos de salud que el nutriólogo
              registra en el expediente (antropometría, padecimientos, resultados de laboratorio,
              notas de consulta, planes) son datos sensibles conforme al artículo 3, fracción VI de
              la LFPDPPP. Se recaban únicamente con tu <strong>consentimiento expreso</strong>,
              que queda registrado con fecha, hora y dirección IP, y se almacenan cifrados en
              reposo.
            </p>
            <p>
              <strong>Datos de pago.</strong> Granola no almacena números de tarjeta. Los pagos los
              procesan directamente Stripe o Mercado Pago bajo sus propios avisos de privacidad.
            </p>

            <h3>1.3 Finalidades</h3>
            <p>
              <strong>Primarias</strong> (necesarias para el servicio): crear y administrar tu
              cuenta; publicar la página pública del nutriólogo; gestionar la agenda y las citas;
              enviar confirmaciones y recordatorios por WhatsApp y correo; procesar y conciliar
              pagos; permitir al nutriólogo llevar el expediente de sus pacientes; emitir
              comprobantes fiscales; atender solicitudes y dar soporte; cumplir obligaciones
              legales.
            </p>
            <p>
              <strong>Secundarias</strong> (puedes negarte sin afectar el servicio): enviarte
              novedades del producto y contenido educativo; elaborar estadísticas de uso
              agregadas y anonimizadas. Para oponerte escribe a{" "}
              <a href="mailto:privacidad@granola.app">privacidad@granola.app</a> o usa el enlace
              para darte de baja en cada comunicación.
            </p>

            <h3>1.4 Transferencias y encargados</h3>
            <p>
              No vendemos ni rentamos tus datos. Compartimos datos únicamente con proveedores que
              nos ayudan a operar el servicio, con contratos que los obligan a protegerlos:
              alojamiento y base de datos (Vercel, Neon), almacenamiento de archivos (Cloudflare),
              mensajería (Meta WhatsApp Business), pagos (Stripe, Mercado Pago), correo
              transaccional (Resend), calendario (Google) cuando lo conectas, analítica de producto
              (PostHog) y monitoreo de errores (Sentry). Algunos de estos proveedores están fuera
              de México; en esos casos aplican las garantías del artículo 36 de la LFPDPPP.
              También podremos transferir datos cuando lo exija una autoridad competente.
            </p>

            <h3>1.5 Derechos ARCO y revocación del consentimiento</h3>
            <p>
              Tienes derecho a <strong>Acceder</strong> a tus datos, <strong>Rectificarlos</strong>,{" "}
              <strong>Cancelarlos</strong> y <strong>Oponerte</strong> a su tratamiento, así como a
              revocar tu consentimiento y limitar su uso o divulgación. Envía tu solicitud a{" "}
              <a href="mailto:privacidad@granola.app">privacidad@granola.app</a> indicando: nombre
              completo, medio para recibir respuesta, documento que acredite tu identidad y la
              descripción clara de lo que solicitas. Respondemos en un máximo de 20 días hábiles y,
              de ser procedente, lo hacemos efectivo dentro de los 15 días hábiles siguientes.
            </p>
            <p>
              Si eres paciente y tus datos clínicos los registró un nutriólogo, puedes ejercer tus
              derechos directamente con él o ella; si lo prefieres, canalizamos tu solicitud.
            </p>

            <h3>1.6 Conservación y seguridad</h3>
            <p>
              Conservamos los datos mientras tu cuenta esté activa y por el tiempo que exijan las
              obligaciones legales y fiscales aplicables. Al cerrar la cuenta eliminamos o
              anonimizamos la información en un plazo máximo de 90 días, salvo la que debamos
              conservar por ley. Aplicamos medidas administrativas, técnicas y físicas: cifrado en
              tránsito y en reposo, control de acceso por sesión, bitácora de accesos a datos
              clínicos y revisiones periódicas.
            </p>

            <h3>1.7 Cookies y tecnologías similares</h3>
            <p>
              Usamos cookies estrictamente necesarias para mantener tu sesión y cookies de
              analítica para entender cómo se usa el producto. Puedes deshabilitarlas desde tu
              navegador; las necesarias para la sesión no pueden desactivarse sin cerrar sesión.
            </p>

            <h3>1.8 Cambios al aviso</h3>
            <p>
              Publicaremos cualquier cambio en esta misma dirección e indicaremos la fecha de la
              última actualización. Si el cambio es relevante, te avisaremos por correo o dentro
              de la aplicación.
            </p>
            <p>
              Si consideras que tu derecho a la protección de datos ha sido vulnerado, puedes
              acudir al Instituto Nacional de Transparencia, Acceso a la Información y Protección
              de Datos Personales (INAI) o la autoridad que lo sustituya.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="nutriologo" className={cn(prose, "mt-16")}>
            <h2>2. Plantilla de aviso de privacidad para tu consulta</h2>
            <p className="rounded-2xl border border-accent/40 bg-accent-soft/50 p-4 text-sm">
              <strong>Para nutriólogos.</strong> Como responsable de los datos de tus pacientes,
              la LFPDPPP te obliga a poner a su disposición tu propio aviso de privacidad. Puedes
              copiar esta plantilla, sustituir lo que va entre corchetes y publicarla en tu página
              o entregarla en consulta. No constituye asesoría legal: revísala con tu abogado si
              atiendes casos especiales (menores, investigación, clínicas con varios
              profesionales).
            </p>

            <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-[15px] leading-relaxed shadow-soft">
              <h3 className="!mt-0">Aviso de privacidad simplificado</h3>
              <p>
                <strong>[Nombre completo del nutriólogo/a]</strong>, con cédula profesional{" "}
                <strong>[número]</strong> y domicilio en <strong>[ciudad, estado]</strong>, es
                responsable del tratamiento de tus datos personales.
              </p>
              <p>
                <strong>Datos que recabo:</strong> nombre, teléfono (WhatsApp), correo electrónico,
                fecha de nacimiento y sexo; y como datos sensibles de salud: peso, estatura,
                circunferencias y otras mediciones, antecedentes, padecimientos, medicamentos,
                hábitos de alimentación, resultados de laboratorio y lo que compartas durante la
                consulta.
              </p>
              <p>
                <strong>Para qué los uso:</strong> agendar y recordarte tus citas; realizar la
                valoración nutricional; diseñar, entregar y dar seguimiento a tu plan de
                alimentación; cobrar la consulta y emitir tu comprobante si lo solicitas;
                contactarte por WhatsApp o correo sobre tu tratamiento.{" "}
                <em>Finalidad secundaria:</em> enviarte contenido educativo y promociones. Si no
                deseas recibirlo, indícamelo y seguirás recibiendo la atención sin cambios.
              </p>
              <p>
                <strong>Consentimiento para datos de salud:</strong> al marcar la casilla
                correspondiente al agendar o firmar este aviso en consulta, otorgas tu
                consentimiento expreso para el tratamiento de tus datos de salud con las
                finalidades descritas.
              </p>
              <p>
                <strong>Con quién los comparto:</strong> uso la plataforma Granola para operar mi
                consulta (agenda, expediente, mensajes y cobros), la cual actúa como encargada
                bajo mis instrucciones y conforme a su aviso en{" "}
                <Link href="/privacidad">granola.app/privacidad</Link>. No transfiero tus datos a
                terceros sin tu consentimiento, salvo requerimiento de autoridad.
              </p>
              <p>
                <strong>Tus derechos (ARCO):</strong> puedes acceder, rectificar, cancelar u
                oponerte al tratamiento de tus datos, así como revocar tu consentimiento,
                escribiéndome a <strong>[correo electrónico]</strong> o por WhatsApp al{" "}
                <strong>[número]</strong>. Te responderé en un máximo de 20 días hábiles.
              </p>
              <p>
                <strong>Conservación:</strong> conservaré tu expediente mientras dure nuestra
                relación profesional y por el plazo que marque la normativa sanitaria aplicable
                (NOM-004-SSA3-2012: al menos 5 años a partir del último acto médico), después lo
                eliminaré de forma segura.
              </p>
              <p>
                <strong>Cambios:</strong> cualquier modificación a este aviso la publicaré en{" "}
                <strong>[tu página pública / consultorio]</strong>.
              </p>
              <p className="!mb-0 text-sm text-muted-foreground">
                Última actualización: <strong>[fecha]</strong>.
              </p>
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
