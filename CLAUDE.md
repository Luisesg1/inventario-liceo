# Reglas de negocio (obligatorias)

Antes de continuar con cualquier modificación del sistema, recuerda que existen reglas de negocio que no deben romperse.

## 1. El RUT es la llave principal del sistema

Todo el sistema debe funcionar utilizando el RUT como identificador único del funcionario.
Todas las relaciones entre módulos deben realizarse mediante el RUT y no por nombre, correo o ID generado.

Esto incluye, entre otros:
- Hoja de Vida
- Usuarios
- Ausencias
- Reemplazos
- Contratos
- Evaluaciones
- Capacitaciones
- Licencias médicas
- Permisos administrativos
- Documentos
- Anotaciones
- Auditoría
- Cualquier otro módulo relacionado con personal

Si un funcionario cambia de correo, teléfono o cargo, su historial debe mantenerse intacto, ya que todo se relaciona mediante el RUT.

## 2. No permitir datos duplicados

Validar en todo el sistema que no puedan existir duplicados en los siguientes campos:
- RUT
- Correo electrónico
- Número de teléfono celular

Si alguno ya existe, impedir el registro y mostrar un mensaje claro indicando el motivo.

## 3. Gestión de Usuarios es la rama madre

El módulo Gestión de Usuarios es el origen de todos los usuarios del sistema.
Todos los demás módulos deben obtener la información desde este módulo.
No deben existir usuarios "paralelos" creados en otras tablas sin relación con Gestión de Usuarios.
Toda la información del personal debe sincronizarse desde esta fuente.

## 4. Registro normal de usuarios

Cuando un usuario crea una cuenta desde el proceso normal de registro, siempre debe crearse inicialmente con el rol de Docente, a menos que un administrador posteriormente cambie su rol.
No asignar automáticamente otros roles durante el registro.

## 5. Usuarios creados desde Ausencias o Reemplazos

Cuando se registre un funcionario nuevo desde los módulos de Ausencias o Reemplazos, el sistema debe permitir asignar el rol correspondiente en ese mismo proceso (por ejemplo: Docente, Asistente de la Educación, Administrativo, etc.).
Ese usuario debe crearse correctamente en Gestión de Usuarios, quedando completamente integrado al sistema y respetando todas las validaciones (RUT, correo y teléfono únicos).

## 6. Fuente única de información

No duplicar información entre módulos.
Cada módulo debe consumir la información desde la fuente correspondiente y mantener una única versión de los datos.

## 7. Integridad de datos

Antes de finalizar cualquier desarrollo, validar que:
- No existan usuarios duplicados
- No existan RUT duplicados
- No existan correos duplicados
- No existan teléfonos duplicados
- Todas las relaciones entre módulos utilicen el RUT
- Todos los cambios se reflejen automáticamente en los módulos relacionados sin perder información histórica

Estas reglas son parte de la arquitectura del sistema y deben respetarse en cualquier modificación o nueva funcionalidad.
