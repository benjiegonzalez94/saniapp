import Link from 'next/link';
import type { Metadata } from 'next';

import {
  DocumentoLegal,
  PorCompletar,
  Puntos,
  Seccion,
} from '@/components/publico/documento-legal';

export const metadata: Metadata = {
  title: 'Términos de servicio',
  description:
    'Condiciones de uso de SaniTi: naturaleza del servicio, responsabilidades de la ' +
    'institución, disponibilidad, facturación por suscripción y asientos.',
};

/**
 * Dos puntos de este texto no son negociables porque describen decisiones que
 * están en el código y en la base de datos, no promesas comerciales: SaniTi no
 * ejerce la medicina, y una factura impaga no cierra una historia clínica.
 */
export default function PaginaTerminos() {
  return (
    <DocumentoLegal
      titulo="Términos de servicio"
      entradilla="Condiciones bajo las que una institución de salud contrata y utiliza SaniTi. Al crear una cuenta o usar la plataforma, la institución y sus usuarios aceptan estos términos."
      version="1.0"
      vigencia="[fecha de entrada en vigencia]"
    >
      <Seccion titulo="1. Qué es SaniTi y qué no es">
        <p>
          SaniTi es una plataforma de{' '}
          <strong>gestión clínica</strong> que se
          entrega como servicio en línea: historia clínica electrónica, agenda, estudios y
          documentos, prescripciones y comunicación con el paciente.
        </p>
        <p className="rounded-(--radius-md) bg-(--color-aviso-suave) px-4 py-3">
          SaniTi{' '}
          <strong>
            no presta servicios médicos, no diagnostica, no prescribe y no sustituye el
            criterio clínico
          </strong>{' '}
          del profesional. Las alertas del sistema —cruce de alergias, avisos de interacción,
          recordatorios— son apoyo a la decisión: informan, no deciden. La responsabilidad del
          acto médico y de lo que se registra en la historia clínica es del profesional y de la
          institución.
        </p>
        <p>
          Tampoco es un servicio de emergencias ni un canal de atención urgente. Ante una
          emergencia debe acudirse a un servicio de emergencia o llamar al ECU 911.
        </p>
      </Seccion>

      <Seccion titulo="2. Quién contrata y quién usa">
        <p>
          El contrato se celebra con la{' '}
          <strong>institución</strong> —clínica,
          hospital o consultorio—, que administra las cuentas de su equipo: médicos,
          enfermería, recepción, facturación y auditoría.
        </p>
        <Puntos>
          <li>
            Las cuentas son personales e intransferibles. Compartir credenciales destruye la
            trazabilidad de la bitácora, que es justamente lo que protege al paciente y también
            al profesional cuando hay que demostrar quién hizo qué.
          </li>
          <li>
            La institución da de alta y de baja a sus usuarios, y asigna los roles con criterio
            de mínimo necesario. La baja de quien deja de prestar servicios debe hacerse el
            mismo día.
          </li>
          <li>
            Cada usuario responde de mantener sus credenciales seguras y de avisar de inmediato
            si sospecha que su cuenta fue usada por otra persona.
          </li>
        </Puntos>
      </Seccion>

      <Seccion titulo="3. Responsabilidad sobre los datos de los pacientes">
        <p>
          La institución es la{' '}
          <strong>responsable</strong> del
          tratamiento de los datos de sus pacientes; SaniTi actúa como{' '}
          <strong>encargado</strong> y trata esos
          datos siguiendo sus instrucciones. El detalle está en la{' '}
          <Link
            href="/legal/privacidad"
            className="text-(--color-acento-fuerte) underline underline-offset-2"
          >
            política de privacidad
          </Link>
          .
        </p>
        <p>En consecuencia, corresponde a la institución:</p>
        <Puntos>
          <li>
            Recabar y conservar el consentimiento explícito de sus pacientes para el
            tratamiento de datos de salud y para cada canal de comunicación, e informarles
            conforme a la LOPDP.
          </li>
          <li>
            Velar por la exactitud de lo que registra y atender, en el plazo legal de quince
            (15) días, las solicitudes de acceso, rectificación, eliminación, portabilidad,
            oposición o limitación que reciba.
          </li>
          <li>
            Revisar los accesos de emergencia (break-glass) que se produzcan en su institución:
            la plataforma los concede acotados y los registra, pero quien debe examinar si
            estuvieron justificados es la institución.
          </li>
          <li>
            Designar y publicar el contacto de su responsable de protección de datos.
          </li>
        </Puntos>
        <p>
          El personal de SaniTi no accede al contenido clínico. Cuando una incidencia sólo
          pueda resolverse consultando un dato concreto, se solicitará autorización expresa a
          la institución y el acceso quedará registrado en la bitácora como cualquier otro.
          SaniTi no utiliza el contenido clínico para fines propios ni para entrenar modelos.
        </p>
      </Seccion>

      <Seccion titulo="4. Uso aceptable">
        <Puntos>
          <li>
            La plataforma se usa para la atención y la gestión sanitarias, no para otros fines.
          </li>
          <li>
            No se permite eludir los controles de acceso, extraer datos de forma masiva o
            automatizada al margen de las funciones de exportación previstas, ni realizar
            pruebas de seguridad sin autorización escrita.
          </li>
          <li>
            No se permite subir contenido ilícito ni ajeno a la atención del paciente al que
            corresponde el expediente.
          </li>
          <li>La institución responde por el uso que hagan las cuentas que administra.</li>
        </Puntos>
      </Seccion>

      <Seccion titulo="5. Disponibilidad y mantenimiento">
        <p>
          SaniTi se compromete a mantener el servicio disponible con un objetivo de{' '}
          <PorCompletar>[nivel de disponibilidad comprometido]</PorCompletar> y a realizar el
          mantenimiento programado fuera del horario habitual de consulta, avisando con al
          menos <PorCompletar>[plazo de aviso de mantenimiento]</PorCompletar> de antelación.
        </p>
        <p>
          No se garantiza un servicio ininterrumpido: depende también de la conexión a
          internet, del suministro eléctrico y de proveedores externos. Se recomienda a cada
          institución mantener un procedimiento de contingencia en papel para poder atender
          durante una caída, por breve que sea.
        </p>
        <p>
          Las copias de seguridad se realizan con una frecuencia de{' '}
          <PorCompletar>[frecuencia de las copias de seguridad]</PorCompletar> y se conservan{' '}
          <PorCompletar>[retención de las copias]</PorCompletar>. Su restauración se ensaya
          periódicamente: una copia que nunca se ha restaurado no es una copia, es una
          suposición.
        </p>
      </Seccion>

      <Seccion titulo="6. Planes, asientos y facturación">
        <Puntos>
          <li>
            La suscripción se contrata por institución, en dólares de los Estados Unidos (USD)
            y por adelantado según el intervalo del plan elegido. Los precios vigentes son los
            publicados en la{' '}
            <Link
              href="/precios"
              className="text-(--color-acento-fuerte) underline underline-offset-2"
            >
              página de precios
            </Link>
            .
          </li>
          <li>
            Cada plan incluye un número de{' '}
            <strong>asientos</strong> (usuarios
            activos). El contador se ajusta automáticamente con las altas y bajas del equipo, y
            los asientos que superen los incluidos se facturan al precio de asiento adicional
            del plan. El rol de auditoría no consume asiento.
          </li>
          <li>
            El periodo de prueba dura los días indicados en el plan y no exige tarjeta de
            crédito. Al terminar, la institución decide si continúa.
          </li>
          <li>
            El pago se realiza con tarjeta a través de PayPhone o Kushki, o por transferencia o
            depósito bancario. Al importe se añade el IVA a la tasa vigente en el Ecuador.
          </li>
          <li>
            Los cambios de precio se comunican con{' '}
            <PorCompletar>[plazo de aviso de cambios de precio]</PorCompletar> de antelación a
            la renovación. Un cambio a un plan superior puede aplicarse de inmediato con el
            prorrateo correspondiente; uno a un plan inferior surte efecto en el siguiente
            periodo.
          </li>
        </Puntos>
      </Seccion>

      <Seccion titulo="7. Impago: lo que nunca ocurre">
        <p className="rounded-(--radius-md) bg-(--color-acento-suave) px-4 py-3">
          <strong>Una factura impaga nunca bloquea el acceso a una historia clínica.</strong>{' '}
          Ni la lectura, ni la exportación, ni la impresión de lo ya registrado. Es una regla
          del producto y está aplicada en la base de datos, no confiada a la buena voluntad de
          quien cobra.
        </p>
        <p>
          Tras el vencimiento hay un periodo de gracia de{' '}
          <PorCompletar>[días de gracia]</PorCompletar>. Si la deuda persiste, se restringe la
          creación de datos nuevos y las funciones accesorias —agendar, registrar consultas
          nuevas, enviar recordatorios—, jamás el acceso a lo ya registrado. Un impago es un
          problema comercial; dejar a un médico sin el expediente de su paciente sería un
          problema de seguridad del paciente.
        </p>
      </Seccion>

      <Seccion titulo="8. Cancelación y salida">
        <Puntos>
          <li>
            La institución puede cancelar cuando quiera, con efecto al final del periodo ya
            pagado. No hay devolución del periodo en curso, salvo cuando la ley lo exija.
          </li>
          <li>
            Antes y después de la baja, la institución puede exportar sus datos en un formato
            estructurado y de uso común. La salida no se retiene como palanca comercial.
          </li>
          <li>
            Tras la baja, los datos se conservan{' '}
            <PorCompletar>[plazo de conservación tras la baja]</PorCompletar> para permitir la
            recuperación y el traslado, y después se eliminan, salvo lo que la ley obligue a
            conservar.
          </li>
          <li>
            SaniTi puede suspender funciones ante un uso que ponga en riesgo la seguridad de
            los datos o incumpla gravemente estos términos, notificándolo a la institución.
            Incluso en ese caso se mantiene el acceso de lectura y exportación de las historias
            clínicas.
          </li>
        </Puntos>
      </Seccion>

      <Seccion titulo="9. Propiedad">
        <p>
          El software, la marca y la documentación de SaniTi son de su titular y se licencian
          para su uso mientras dure la suscripción. Los datos clínicos y administrativos que la
          institución registra siguen siendo suyos y de sus pacientes: SaniTi no adquiere
          derecho alguno sobre ellos.
        </p>
      </Seccion>

      <Seccion titulo="10. Responsabilidad">
        <p>
          SaniTi responde del funcionamiento de la plataforma conforme a estos términos. No
          responde de las decisiones clínicas ni de su documentación, de la exactitud de lo que
          se registra, del uso que hagan las cuentas administradas por la institución ni de las
          interrupciones causadas por terceros ajenos al servicio.
        </p>
        <p>
          La responsabilidad total de SaniTi frente a la institución se limita a{' '}
          <PorCompletar>[límite de responsabilidad acordado]</PorCompletar>. Nada de lo
          anterior excluye la responsabilidad por dolo o culpa grave, ni aquella que la ley
          ecuatoriana no permite limitar.
        </p>
      </Seccion>

      <Seccion titulo="11. Cambios en estos términos">
        <p>
          Los cambios se comunican con{' '}
          <PorCompletar>[plazo de aviso de cambios de los términos]</PorCompletar> de antelación
          a su entrada en vigor. Continuar usando el servicio después de esa fecha supone
          aceptarlos; si la institución no está de acuerdo, puede cancelar sin penalidad antes
          de que se apliquen.
        </p>
      </Seccion>

      <Seccion titulo="12. Ley aplicable y contacto">
        <p>
          Estos términos se rigen por la legislación ecuatoriana. Las controversias que no se
          resuelvan de común acuerdo se someterán a{' '}
          <PorCompletar>[mediación o jurisdicción acordada y ciudad]</PorCompletar>.
        </p>
        <p>
          Contacto comercial: <PorCompletar>[correo comercial]</PorCompletar>. Soporte:{' '}
          <PorCompletar>[correo de soporte]</PorCompletar>. Protección de datos:{' '}
          <PorCompletar>[correo del responsable de datos]</PorCompletar>.
        </p>
      </Seccion>
    </DocumentoLegal>
  );
}
