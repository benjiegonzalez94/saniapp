import Link from 'next/link';
import type { Metadata } from 'next';

import {
  DocumentoLegal,
  PorCompletar,
  Puntos,
  Seccion,
} from '@/components/publico/documento-legal';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description:
    'Cómo trata SaniTi los datos personales y de salud registrados en la plataforma, ' +
    'conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador.',
};

/**
 * Este texto describe lo que el sistema hace de verdad —cifrado, aislamiento,
 * auditoría, consentimiento aplicado en la base—, no un ideal. Si cambia una de
 * esas decisiones, este documento cambia con ella: una política que promete más
 * de lo que el código cumple es, ante la autoridad, una declaración falsa.
 */
export default function PaginaPrivacidad() {
  return (
    <DocumentoLegal
      titulo="Política de privacidad"
      entradilla="Cómo se tratan los datos personales y de salud registrados en SaniTi, y qué derechos tiene usted sobre ellos, conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP) y su Reglamento."
      version="1.0"
      vigencia="[fecha de entrada en vigencia]"
    >
      <Seccion titulo="1. Quién responde por sus datos">
        <p>
          La institución de salud que le atiende —clínica, hospital o consultorio— es la{' '}
          <strong>responsable</strong> del
          tratamiento: decide qué se registra en su historia clínica, para qué y durante
          cuánto tiempo.
        </p>
        <p>
          SaniTi es el <strong>encargado</strong>:
          opera la plataforma por cuenta de esa institución y siguiendo sus instrucciones. No
          usa los datos clínicos para fines propios, no los cede ni los comercializa.
        </p>
        <p>
          Cada institución registra en la plataforma el contacto de su responsable de
          protección de datos (LOPDP, art. 47). Si el suyo no aparece en la documentación que
          le entregaron, puede pedirlo directamente en el establecimiento.
        </p>
        <Puntos>
          <li>
            Institución responsable:{' '}
            <PorCompletar>[razón social de la institución]</PorCompletar>,{' '}
            <PorCompletar>[correo del responsable de datos]</PorCompletar>,{' '}
            <PorCompletar>[dirección]</PorCompletar>.
          </li>
          <li>
            SaniTi, en calidad de encargado:{' '}
            <PorCompletar>[razón social y RUC de SaniTi]</PorCompletar>,{' '}
            <PorCompletar>[correo de privacidad de SaniTi]</PorCompletar>,{' '}
            <PorCompletar>[dirección]</PorCompletar>.
          </li>
        </Puntos>
      </Seccion>

      <Seccion titulo="2. Qué datos se tratan">
        <p>Sólo los necesarios para prestar y documentar la atención:</p>
        <Puntos>
          <li>
            <strong>Identificación y contacto:</strong>{' '}
            nombres y apellidos, fecha de nacimiento, sexo al nacer e identidad de género si se
            registra, cédula o pasaporte, teléfono, correo electrónico, dirección, ciudad y
            provincia, tipo de sangre y contacto de emergencia.
          </li>
          <li>
            <strong>Datos de salud (categoría especial):</strong>{' '}
            motivo de consulta y notas clínicas, diagnósticos codificados en CIE-10, signos
            vitales, alergias, prescripciones, estudios y los archivos que los acompañan,
            citas y su estado.
          </li>
          <li>
            <strong>Del personal de salud:</strong>{' '}
            nombre, correo, rol, institución a la que pertenece y eventos de autenticación
            (fecha, dirección IP, navegador y si el intento tuvo éxito), necesarios para
            detectar accesos indebidos.
          </li>
          <li>
            <strong>Registros de auditoría:</strong>{' '}
            qué expediente se abrió, quién lo abrió, cuándo, con qué rol, desde qué dirección y
            —cuando el acceso fue de emergencia— con qué motivo declarado.
          </li>
          <li>
            <strong>Facturación:</strong> datos de
            la institución (razón social, RUC, plan, número de usuarios y facturas). No se
            tratan números de tarjeta: los captura y custodia la pasarela de pago.
          </li>
        </Puntos>
      </Seccion>

      <Seccion titulo="3. Base legal y finalidad">
        <p>
          Los datos de salud son de categoría especial y su tratamiento exige{' '}
          <strong>consentimiento explícito, informado y revocable</strong>{' '}
          (LOPDP, arts. 7 y 9), que se recaba por finalidad y por canal, no en bloque.
        </p>
        <Puntos>
          <li>
            <strong>Consentimiento:</strong>{' '}
            atención médica y registro de la historia clínica; recordatorios y agendamiento por
            WhatsApp, SMS o correo; compartir el caso con otro profesional de la misma
            institución; derivación a otra institución; y uso secundario anonimizado con fines
            de investigación.
          </li>
          <li>
            <strong>Obligación legal:</strong>{' '}
            llevar y conservar la historia clínica y emitir los comprobantes tributarios.
          </li>
          <li>
            <strong>Ejecución del contrato:</strong>{' '}
            las cuentas del personal y la relación comercial con la institución.
          </li>
          <li>
            <strong>Interés vital:</strong> el
            acceso de emergencia a una historia clínica cuando la vida o la salud del paciente
            lo exigen, en las condiciones del apartado 5.
          </li>
        </Puntos>
        <p>
          De cada consentimiento queda constancia de cómo se obtuvo —presencial, en papel, por
          el portal, por WhatsApp o por teléfono— y de la versión de este texto sobre la que se
          otorgó. No se toman decisiones automatizadas con efectos jurídicos sobre usted: los
          avisos de interacción con alergias asisten al criterio del profesional, no lo
          sustituyen.
        </p>
      </Seccion>

      <Seccion titulo="4. Consentimiento y comunicaciones">
        <p>
          Ningún mensaje sale hacia un paciente sin consentimiento vigente para ese canal, y no
          es el programa de envío quien lo comprueba: lo verifica la propia base de datos antes
          de aceptar el mensaje en la cola. Ninguna vía —ni un proceso automático, ni un
          administrador— puede saltarse esa comprobación.
        </p>
        <p>
          Un envío sin consentimiento no se descarta en silencio: queda marcado como tal y se
          conserva, para que pueda comprobarse qué se quiso enviar y por qué no salió.
        </p>
        <p>
          Revocar el consentimiento cancela automáticamente lo que estuviera pendiente de
          enviarse. Los consentimientos no se editan ni se borran: revocar es una declaración
          nueva, de modo que el historial completo queda disponible.
        </p>
      </Seccion>

      <Seccion titulo="5. Cómo se protegen">
        <Puntos>
          <li>
            <strong>Aislamiento por institución.</strong>{' '}
            Los datos de cada institución están separados dentro de la propia base de datos.
            Una consulta mal escrita en la aplicación no puede devolver el paciente de otra
            clínica, porque la base no entrega la fila.
          </li>
          <li>
            <strong>Cifrado.</strong> La cédula o
            pasaporte, las notas clínicas y los mensajes de interconsulta se guardan cifrados
            con AES-256-GCM, con claves que no residen en la base de datos: un respaldo robado
            no revela su contenido. Cada valor cifrado queda ligado a la fila donde vive, así
            que mover una nota de un expediente a otro hace que el descifrado falle en lugar de
            pasar inadvertido.
          </li>
          <li>
            <strong>Búsqueda sin exponer.</strong>{' '}
            Para poder buscar por documento sin guardarlo legible se usa un índice ciego con
            clave propia, que sólo admite coincidencia exacta.
          </li>
          <li>
            <strong>Lo que queda legible.</strong>{' '}
            El nombre, la fecha de nacimiento, los diagnósticos, las alergias y los signos
            vitales se guardan sin cifrar porque son la base de las búsquedas y de las alertas
            de seguridad del paciente. Los protegen el aislamiento, el cifrado del disco y la
            auditoría de accesos.
          </li>
          <li>
            <strong>Archivos de estudios.</strong>{' '}
            Se analizan con un antivirus alojado en la propia infraestructura: un examen de
            laboratorio lleva nombre, cédula y diagnóstico, y enviarlo a un servicio externo de
            análisis sería transferirlo a un tercero. Sólo se entregan mediante enlaces
            firmados y temporales, nunca por una dirección pública.
          </li>
          <li>
            <strong>Mínimo necesario.</strong> Cada
            rol ve lo justo para su trabajo: recepción agenda citas sin poder abrir la historia
            clínica, y enfermería registra sin poder firmar.
          </li>
          <li>
            <strong>Acceso de emergencia.</strong>{' '}
            Un profesional ajeno al equipo tratante puede acceder en una urgencia declarando
            por escrito el motivo. El acceso se registra antes de concederse, caduca a las
            cuatro horas y queda pendiente de revisión por un responsable de la institución.
          </li>
          <li>
            <strong>En tránsito.</strong> Todo
            viaja cifrado (TLS), la sesión se valida contra el servidor de autenticación en
            cada petición y las zonas privadas no se guardan en la memoria del navegador: en
            una clínica donde se comparte computadora entre turnos, el botón «atrás» no puede
            mostrar el expediente del paciente anterior.
          </li>
        </Puntos>
      </Seccion>

      <Seccion titulo="6. Todo acceso queda auditado">
        <p>
          No se registra sólo quién modificó un dato, sino{' '}
          <strong>quién abrió cada expediente</strong>
          , con fecha, actor, rol y origen. Ésa es la pregunta que responde una auditoría de
          protección de datos.
        </p>
        <p>
          La bitácora está encadenada criptográficamente: cada evento sella el anterior, de
          modo que alterar o eliminar uno rompe la cadena y se detecta. No existe forma de
          modificarla ni de borrarla desde la aplicación, ni siquiera con credenciales de
          administración.
        </p>
        <p>
          Usted puede solicitar a su institución el detalle de los accesos a su historia
          clínica.
        </p>
      </Seccion>

      <Seccion titulo="7. Quiénes más intervienen">
        <p>
          SaniTi se apoya en proveedores que actúan como encargados, con contrato e
          instrucciones y sin más datos que los necesarios:
        </p>
        <Puntos>
          <li>
            Alojamiento e infraestructura de base de datos:{' '}
            <PorCompletar>[proveedor de alojamiento]</PorCompletar>, en{' '}
            <PorCompletar>[país o región del centro de datos]</PorCompletar>.
          </li>
          <li>
            Cobros a la institución: PayPhone y Kushki. No reciben datos clínicos ni de
            pacientes.
          </li>
          <li>
            Mensajería con el paciente: WhatsApp (Meta) y{' '}
            <PorCompletar>[proveedor de SMS]</PorCompletar>, únicamente si usted lo consintió y
            sólo con los datos mínimos del recordatorio.
          </li>
        </Puntos>
        <p>
          Los archivos de estudios no se envían a servicios externos de análisis. Si el
          alojamiento supone una transferencia internacional de datos, se realiza con las
          garantías que exige la LOPDP y se detalla en{' '}
          <PorCompletar>[anexo de transferencias internacionales]</PorCompletar>.
        </p>
      </Seccion>

      <Seccion titulo="8. Cuánto tiempo se conservan">
        <Puntos>
          <li>
            La <strong>historia clínica</strong> se
            conserva mientras la normativa sanitaria obligue a custodiarla:{' '}
            <PorCompletar>
              [plazo de conservación de la historia clínica según la normativa aplicable]
            </PorCompletar>
            . Por eso un expediente no se destruye al solicitarlo: se archiva y deja de
            utilizarse.
          </li>
          <li>
            La <strong>bitácora de auditoría</strong>{' '}
            se conserva <PorCompletar>[plazo de conservación de la bitácora]</PorCompletar> y
            después se elimina por bloques mensuales completos, nunca evento a evento, para no
            romper la cadena que prueba su integridad.
          </li>
          <li>
            Los <strong>consentimientos</strong> y
            sus revocaciones se conservan como prueba mientras dure la relación y el plazo de
            prescripción de responsabilidades.
          </li>
          <li>
            Las <strong>facturas</strong> y
            registros contables, durante el plazo que exige la normativa tributaria.
          </li>
        </Puntos>
        <p>
          Cumplidos esos plazos, los datos se eliminan o se anonimizan de forma que no puedan
          volver a asociarse con usted.
        </p>
      </Seccion>

      <Seccion titulo="9. Sus derechos">
        <p>Como titular de los datos, usted puede ejercer en cualquier momento:</p>
        <Puntos>
          <li>
            <strong>Acceso:</strong> saber qué
            datos suyos se tratan, con qué finalidad y quién los ha consultado.
          </li>
          <li>
            <strong>Rectificación y actualización:</strong>{' '}
            corregir lo inexacto o incompleto.
          </li>
          <li>
            <strong>Eliminación:</strong> suprimir
            sus datos cuando ya no sean necesarios o retire el consentimiento, salvo lo que la
            ley obliga a conservar.
          </li>
          <li>
            <strong>Portabilidad:</strong> recibir
            sus datos en un formato estructurado y de uso común, o pedir que se remitan a otro
            prestador.
          </li>
          <li>
            <strong>Oposición:</strong> oponerse a
            un tratamiento concreto por motivos relativos a su situación particular.
          </li>
          <li>
            <strong>Suspensión o limitación del tratamiento:</strong>{' '}
            que sus datos se conserven pero dejen de utilizarse mientras se resuelve una
            controversia.
          </li>
          <li>
            <strong>Revocar el consentimiento,</strong>{' '}
            sin que ello afecte la licitud del tratamiento anterior.
          </li>
        </Puntos>
        <p>
          Las solicitudes se responden en un plazo máximo de{' '}
          <strong>quince (15) días</strong>{' '}
          contados desde su recepción. Se le pedirá acreditar su identidad: entregar una
          historia clínica a quien no es su titular sería, en sí mismo, la vulneración que esta
          política evita.
        </p>
        <p>
          Diríjase a la institución que le atiende, a{' '}
          <PorCompletar>[correo del responsable de datos]</PorCompletar>. Si escribe a SaniTi a{' '}
          <PorCompletar>[correo de privacidad de SaniTi]</PorCompletar>, trasladaremos su
          solicitud a la institución responsable y le informaremos de ello, ya que como
          encargados no podemos decidir por ella.
        </p>
        <p>
          Si considera vulnerados sus derechos, puede presentar un reclamo ante la
          Superintendencia de Protección de Datos Personales del Ecuador.
        </p>
      </Seccion>

      <Seccion titulo="10. Menores de edad y personas bajo representación">
        <p>
          Los datos de pacientes menores de edad o sujetos a representación legal se tratan con
          el consentimiento de su representante, que la institución debe recabar y dejar
          registrado, sin perjuicio del derecho del menor a ser oído según su grado de madurez.
        </p>
      </Seccion>

      <Seccion titulo="11. Cookies y sesión">
        <p>
          La plataforma sólo utiliza cookies estrictamente necesarias para mantener su sesión
          iniciada y protegerla. No hay cookies publicitarias, ni de perfilado, ni herramientas
          de analítica de terceros.
        </p>
      </Seccion>

      <Seccion titulo="12. Incidentes de seguridad">
        <p>
          Si se produce una vulneración que afecte a sus datos, se notifica a la autoridad de
          protección de datos y, cuando corresponda, a las personas afectadas, sin dilación y
          dentro de los plazos que fija la LOPDP, con la información necesaria para que puedan
          tomar medidas.
        </p>
      </Seccion>

      <Seccion titulo="13. Cambios en esta política">
        <p>
          Cada consentimiento queda ligado a la versión del texto sobre la que se otorgó. Si
          cambia algo esencial de esta política se publica una versión nueva y se solicita
          nuevamente el consentimiento allí donde la ley lo exige. La versión vigente es la que
          consta al inicio de esta página.
        </p>
        <p>
          Las condiciones de uso del servicio se detallan en los{' '}
          <Link
            href="/legal/terminos"
            className="text-(--color-acento-fuerte) underline underline-offset-2"
          >
            términos de servicio
          </Link>
          .
        </p>
      </Seccion>
    </DocumentoLegal>
  );
}
