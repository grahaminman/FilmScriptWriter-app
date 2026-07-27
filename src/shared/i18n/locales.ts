/**
 * Application strings for en_GB, es_PY and fr_FR.
 *
 * Keys are stable identifiers used by menus, dialogs and the status bar.
 * The renderer and main process both import from here so menus stay in sync.
 */

import type { LocaleCode } from '../constants/screenplay'

export type MessageKey =
  | 'app.name'
  | 'app.tagline'
  | 'menu.file'
  | 'menu.edit'
  | 'menu.view'
  | 'menu.export'
  | 'menu.theme'
  | 'menu.language'
  | 'menu.settings'
  | 'menu.help'
  | 'menu.file.new'
  | 'menu.file.open'
  | 'menu.file.save'
  | 'menu.file.saveAs'
  | 'menu.file.quit'
  | 'menu.edit.undo'
  | 'menu.edit.redo'
  | 'menu.edit.cut'
  | 'menu.edit.copy'
  | 'menu.edit.paste'
  | 'menu.edit.selectAll'
  | 'menu.edit.find'
  | 'menu.edit.findReplace'
  | 'menu.view.preview'
  | 'menu.view.previewFollow'
  | 'menu.view.typewriter'
  | 'menu.view.syntax'
  | 'menu.view.syntaxColors'
  | 'menu.view.fontIncrease'
  | 'menu.view.fontDecrease'
  | 'menu.view.fontReset'
  | 'menu.view.toggleDevTools'
  | 'menu.view.reload'
  | 'menu.export.fountain'
  | 'menu.export.fdx'
  | 'menu.export.pdf'
  | 'menu.theme.light'
  | 'menu.theme.dark'
  | 'menu.theme.system'
  | 'menu.language.en_GB'
  | 'menu.language.es_PY'
  | 'menu.language.fr_FR'
  | 'menu.help.about'
  | 'menu.help.checkUpdates'
  | 'dialog.unsaved.title'
  | 'dialog.unsaved.message'
  | 'dialog.unsaved.save'
  | 'dialog.unsaved.discard'
  | 'dialog.unsaved.cancel'
  | 'dialog.error.title'
  | 'dialog.about.title'
  | 'dialog.about.message'
  | 'status.words'
  | 'status.pages'
  | 'status.ready'
  | 'status.modified'
  | 'status.saved'
  | 'status.untitled'
  | 'status.font'
  | 'status.find'
  | 'status.replace'
  | 'preview.title'
  | 'preview.empty'
  | 'editor.placeholder'
  | 'welcome.title'
  | 'welcome.body'
  | 'common.ok'
  | 'common.cancel'
  | 'common.close'
  | 'update.checking'
  | 'update.available'
  | 'update.none'
  | 'update.error'
  | 'settings.syntaxColors'
  | 'settings.syntaxHint'
  | 'settings.preset'
  | 'settings.resetColors'

export type Messages = Record<MessageKey, string>

const en_GB: Messages = {
  'app.name': 'FilmScriptWriter (Beta)',
  'app.tagline': 'Beta preview — Fountain screenplay editing',
  'menu.file': 'File',
  'menu.edit': 'Edit',
  'menu.view': 'View',
  'menu.export': 'Export',
  'menu.theme': 'Theme',
  'menu.language': 'Language',
  'menu.settings': 'Settings',
  'menu.help': 'Help',
  'menu.file.new': 'New',
  'menu.file.open': 'Open…',
  'menu.file.save': 'Save',
  'menu.file.saveAs': 'Save As…',
  'menu.file.quit': 'Quit',
  'menu.edit.undo': 'Undo',
  'menu.edit.redo': 'Redo',
  'menu.edit.cut': 'Cut',
  'menu.edit.copy': 'Copy',
  'menu.edit.paste': 'Paste',
  'menu.edit.selectAll': 'Select All',
  'menu.edit.find': 'Find',
  'menu.edit.findReplace': 'Find and Replace…',
  'menu.view.preview': 'Toggle Preview',
  'menu.view.previewFollow': 'Preview Follows Editor',
  'menu.view.typewriter': 'Typewriter Mode',
  'menu.view.syntax': 'Syntax Highlighting',
  'menu.view.syntaxColors': 'Syntax Colours…',
  'menu.view.fontIncrease': 'Increase Font Size',
  'menu.view.fontDecrease': 'Decrease Font Size',
  'menu.view.fontReset': 'Reset Font Size',
  'menu.view.toggleDevTools': 'Toggle Developer Tools',
  'menu.view.reload': 'Reload',
  'menu.export.fountain': 'Export as Fountain…',
  'menu.export.fdx': 'Export as Final Draft (.fdx)…',
  'menu.export.pdf': 'Export as PDF…',
  'menu.theme.light': 'Light',
  'menu.theme.dark': 'Dark',
  'menu.theme.system': 'System',
  'menu.language.en_GB': 'English (UK)',
  'menu.language.es_PY': 'Español (Paraguay)',
  'menu.language.fr_FR': 'Français (France)',
  'menu.help.about': 'About',
  'menu.help.checkUpdates': 'Check for Updates…',
  'dialog.unsaved.title': 'Unsaved Changes',
  'dialog.unsaved.message':
    'You have unsaved changes. Do you want to save them before continuing?',
  'dialog.unsaved.save': 'Save',
  'dialog.unsaved.discard': 'Discard',
  'dialog.unsaved.cancel': 'Cancel',
  'dialog.error.title': 'Error',
  'dialog.about.title': 'About FilmScriptWriter (Beta)',
  'dialog.about.message':
    'FilmScriptWriter is a BETA preview of a Fountain screenplay editor (Hollywood pagination, PDF/FDX export, live preview). Features may change; not yet a finished product.',
  'status.words': 'Words',
  'status.pages': 'Pages',
  'status.ready': 'Ready',
  'status.modified': 'Modified',
  'status.saved': 'Saved',
  'status.untitled': 'Untitled',
  'status.font': 'Font',
  'status.find': 'Find',
  'status.replace': 'Replace',
  'preview.title': 'Preview',
  'preview.empty': 'Your paginated screenplay preview will appear here.',
  'editor.placeholder':
    'Start writing your screenplay in Fountain format…\n\nINT. COFFEE SHOP - DAY\n\nA quiet morning. SUNLIGHT streams through the windows.\n\nALICE\n(smiling)\nHello, world.',
  'welcome.title': 'Welcome',
  'welcome.body':
    'Create a new screenplay or open an existing .fountain file to begin.',
  'common.ok': 'OK',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'update.checking': 'Checking for updates…',
  'update.available': 'An update is available.',
  'update.none': 'You are on the latest version.',
  'update.error': 'Could not check for updates.',
  'settings.syntaxColors': 'Syntax colours',
  'settings.syntaxHint':
    'Colours apply to the editor only. Preview stays black-and-white for print fidelity.',
  'settings.preset': 'Preset',
  'settings.resetColors': 'Reset to default'
}

const es_PY: Messages = {
  'app.name': 'FilmScriptWriter (Beta)',
  'app.tagline': 'Vista previa beta — guiones Fountain',
  'menu.file': 'Archivo',
  'menu.edit': 'Editar',
  'menu.view': 'Ver',
  'menu.export': 'Exportar',
  'menu.theme': 'Tema',
  'menu.language': 'Idioma',
  'menu.settings': 'Ajustes',
  'menu.help': 'Ayuda',
  'menu.file.new': 'Nuevo',
  'menu.file.open': 'Abrir…',
  'menu.file.save': 'Guardar',
  'menu.file.saveAs': 'Guardar como…',
  'menu.file.quit': 'Salir',
  'menu.edit.undo': 'Deshacer',
  'menu.edit.redo': 'Rehacer',
  'menu.edit.cut': 'Cortar',
  'menu.edit.copy': 'Copiar',
  'menu.edit.paste': 'Pegar',
  'menu.edit.selectAll': 'Seleccionar todo',
  'menu.edit.find': 'Buscar',
  'menu.edit.findReplace': 'Buscar y reemplazar…',
  'menu.view.preview': 'Alternar vista previa',
  'menu.view.previewFollow': 'Vista previa sigue al editor',
  'menu.view.typewriter': 'Modo máquina de escribir',
  'menu.view.syntax': 'Resaltado de sintaxis',
  'menu.view.syntaxColors': 'Colores de sintaxis…',
  'menu.view.fontIncrease': 'Aumentar tamaño de fuente',
  'menu.view.fontDecrease': 'Reducir tamaño de fuente',
  'menu.view.fontReset': 'Restablecer tamaño de fuente',
  'menu.view.toggleDevTools': 'Herramientas de desarrollo',
  'menu.view.reload': 'Recargar',
  'menu.export.fountain': 'Exportar como Fountain…',
  'menu.export.fdx': 'Exportar como Final Draft (.fdx)…',
  'menu.export.pdf': 'Exportar como PDF…',
  'menu.theme.light': 'Claro',
  'menu.theme.dark': 'Oscuro',
  'menu.theme.system': 'Sistema',
  'menu.language.en_GB': 'English (UK)',
  'menu.language.es_PY': 'Español (Paraguay)',
  'menu.language.fr_FR': 'Français (France)',
  'menu.help.about': 'Acerca de',
  'menu.help.checkUpdates': 'Buscar actualizaciones…',
  'dialog.unsaved.title': 'Cambios sin guardar',
  'dialog.unsaved.message':
    'Hay cambios sin guardar. ¿Desea guardarlos antes de continuar?',
  'dialog.unsaved.save': 'Guardar',
  'dialog.unsaved.discard': 'Descartar',
  'dialog.unsaved.cancel': 'Cancelar',
  'dialog.error.title': 'Error',
  'dialog.about.title': 'Acerca de FilmScriptWriter (Beta)',
  'dialog.about.message':
    'FilmScriptWriter es una vista previa BETA de un editor de guiones Fountain (paginación Hollywood, exportación PDF/FDX, vista previa). Puede cambiar; aún no es un producto final.',
  'status.words': 'Palabras',
  'status.pages': 'Páginas',
  'status.ready': 'Listo',
  'status.modified': 'Modificado',
  'status.saved': 'Guardado',
  'status.untitled': 'Sin título',
  'status.font': 'Fuente',
  'status.find': 'Buscar',
  'status.replace': 'Reemplazar',
  'preview.title': 'Vista previa',
  'preview.empty': 'La vista previa paginada del guion aparecerá aquí.',
  'editor.placeholder':
    'Empiece a escribir su guion en formato Fountain…\n\nINT. CAFETERÍA - DÍA\n\nUna mañana tranquila. La LUZ DEL SOL entra por las ventanas.\n\nALICIA\n(sonriendo)\nHola, mundo.',
  'welcome.title': 'Bienvenido',
  'welcome.body':
    'Cree un guion nuevo o abra un archivo .fountain existente para comenzar.',
  'common.ok': 'Aceptar',
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'update.checking': 'Buscando actualizaciones…',
  'update.available': 'Hay una actualización disponible.',
  'update.none': 'Ya tiene la última versión.',
  'update.error': 'No se pudieron buscar actualizaciones.',
  'settings.syntaxColors': 'Colores de sintaxis',
  'settings.syntaxHint':
    'Los colores solo se aplican al editor. La vista previa permanece en blanco y negro.',
  'settings.preset': 'Preajuste',
  'settings.resetColors': 'Restablecer valores'
}

const fr_FR: Messages = {
  'app.name': 'FilmScriptWriter (Beta)',
  'app.tagline': 'Aperçu bêta — scénarios Fountain',
  'menu.file': 'Fichier',
  'menu.edit': 'Édition',
  'menu.view': 'Affichage',
  'menu.export': 'Exporter',
  'menu.theme': 'Thème',
  'menu.language': 'Langue',
  'menu.settings': 'Réglages',
  'menu.help': 'Aide',
  'menu.file.new': 'Nouveau',
  'menu.file.open': 'Ouvrir…',
  'menu.file.save': 'Enregistrer',
  'menu.file.saveAs': 'Enregistrer sous…',
  'menu.file.quit': 'Quitter',
  'menu.edit.undo': 'Annuler',
  'menu.edit.redo': 'Rétablir',
  'menu.edit.cut': 'Couper',
  'menu.edit.copy': 'Copier',
  'menu.edit.paste': 'Coller',
  'menu.edit.selectAll': 'Tout sélectionner',
  'menu.edit.find': 'Rechercher',
  'menu.edit.findReplace': 'Rechercher et remplacer…',
  'menu.view.preview': 'Basculer l’aperçu',
  'menu.view.previewFollow': 'L’aperçu suit l’éditeur',
  'menu.view.typewriter': 'Mode machine à écrire',
  'menu.view.syntax': 'Coloration syntaxique',
  'menu.view.syntaxColors': 'Couleurs de syntaxe…',
  'menu.view.fontIncrease': 'Augmenter la taille de police',
  'menu.view.fontDecrease': 'Diminuer la taille de police',
  'menu.view.fontReset': 'Réinitialiser la taille de police',
  'menu.view.toggleDevTools': 'Outils de développement',
  'menu.view.reload': 'Recharger',
  'menu.export.fountain': 'Exporter en Fountain…',
  'menu.export.fdx': 'Exporter en Final Draft (.fdx)…',
  'menu.export.pdf': 'Exporter en PDF…',
  'menu.theme.light': 'Clair',
  'menu.theme.dark': 'Sombre',
  'menu.theme.system': 'Système',
  'menu.language.en_GB': 'English (UK)',
  'menu.language.es_PY': 'Español (Paraguay)',
  'menu.language.fr_FR': 'Français (France)',
  'menu.help.about': 'À propos',
  'menu.help.checkUpdates': 'Rechercher les mises à jour…',
  'dialog.unsaved.title': 'Modifications non enregistrées',
  'dialog.unsaved.message':
    'Vous avez des modifications non enregistrées. Voulez-vous les enregistrer avant de continuer ?',
  'dialog.unsaved.save': 'Enregistrer',
  'dialog.unsaved.discard': 'Abandonner',
  'dialog.unsaved.cancel': 'Annuler',
  'dialog.error.title': 'Erreur',
  'dialog.about.title': 'À propos de FilmScriptWriter (Beta)',
  'dialog.about.message':
    'FilmScriptWriter est un aperçu BÊTA d’un éditeur de scénarios Fountain (pagination Hollywood, export PDF/FDX, aperçu). Fonctions susceptibles de changer ; pas encore un produit fini.',
  'status.words': 'Mots',
  'status.pages': 'Pages',
  'status.ready': 'Prêt',
  'status.modified': 'Modifié',
  'status.saved': 'Enregistré',
  'status.untitled': 'Sans titre',
  'status.font': 'Police',
  'status.find': 'Rechercher',
  'status.replace': 'Remplacer',
  'preview.title': 'Aperçu',
  'preview.empty': 'L’aperçu paginé de votre scénario apparaîtra ici.',
  'editor.placeholder':
    'Commencez à écrire votre scénario au format Fountain…\n\nINT. CAFÉ - JOUR\n\nUn matin calme. La LUMIÈRE DU SOLEIL entre par les fenêtres.\n\nALICE\n(souriante)\nBonjour le monde.',
  'welcome.title': 'Bienvenue',
  'welcome.body':
    'Créez un nouveau scénario ou ouvrez un fichier .fountain existant pour commencer.',
  'common.ok': 'OK',
  'common.cancel': 'Annuler',
  'common.close': 'Fermer',
  'update.checking': 'Recherche de mises à jour…',
  'update.available': 'Une mise à jour est disponible.',
  'update.none': 'Vous utilisez la dernière version.',
  'update.error': 'Impossible de rechercher les mises à jour.',
  'settings.syntaxColors': 'Couleurs de syntaxe',
  'settings.syntaxHint':
    'Les couleurs s’appliquent uniquement à l’éditeur. L’aperçu reste en noir et blanc.',
  'settings.preset': 'Préréglage',
  'settings.resetColors': 'Réinitialiser'
}

export const LOCALES: Record<LocaleCode, Messages> = {
  en_GB,
  es_PY,
  fr_FR
}

/**
 * Translate a key for the given locale, falling back to en_GB then the key.
 */
export function t(locale: LocaleCode, key: MessageKey): string {
  return LOCALES[locale]?.[key] ?? LOCALES.en_GB[key] ?? key
}
