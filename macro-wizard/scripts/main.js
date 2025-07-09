Hooks.once('ready', () => {
  console.log('Animation Macro Creator | Módulo inicializado');
  
  // Verificar dependencias
  if (!game.modules.get('sequencer')?.active) {
    ui.notifications.error('Animation Macro Creator requiere el módulo Sequencer activo');
    return;
  }
  if (!game.modules.get('midi-qol')?.active) {
    ui.notifications.error('Animation Macro Creator requiere el módulo MidiQOL activo');
    return;
  }
  if (!game.modules.get('jb2a_patreon')?.active) {
    ui.notifications.error('Animation Macro Creator requiere JB2A Premium activo');
    return;
  }

  // Verificar que AnimationMacroCreator esté definido
  if (typeof AnimationMacroCreator !== "function") {
    ui.notifications.error('No se encontró la clase AnimationMacroCreator');
    return;
  }

  // Inicializar el creador de macros
  game.animationMacroCreator = new AnimationMacroCreator();

  // Agregar botón al panel de controles
  if (ui.controls && ui.controls.controls) {
    ui.controls.controls.push({
      name: 'animation-macro-creator',
      title: 'Creador de Macros de Animación',
      icon: 'fas fa-magic',
      layer: 'TokenLayer',
      tools: [{
        name: 'open-creator',
        title: 'Abrir Creador de Macros',
        icon: 'fas fa-plus',
        onClick: () => game.animationMacroCreator.render(true),
        button: true
      }]
    });
  }

  // Registrar configuraciones
  game.settings.register('animation-macro-creator', 'defaultCompendium', {
    name: 'Compendio por Defecto',
    hint: 'Compendio donde se guardarán los macros creados',
    scope: 'world',
    config: true,
    type: String,
    default: 'animation-macro-creator.animation-macros'
  });

  game.settings.register('animation-macro-creator', 'autoApplyAnimations', {
    name: 'Aplicar Animaciones Automáticamente',
    hint: 'Aplicar automáticamente las animaciones cuando se usen habilidades/hechizos',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
});

// Hook para items de dnd5e
Hooks.on('dnd5e.useItem', async (item, config, options) => {
  if (!game.settings.get('animation-macro-creator', 'autoApplyAnimations')) return;

  try {
    const macroName = `${item.name}_animation`;
    const pack = game.packs.get(game.settings.get('animation-macro-creator', 'defaultCompendium'));
    if (pack) {
      await pack.getIndex(); // Asegura que el índice esté cargado
      const macro = pack.index.find(m => m.name === macroName);
      if (macro) {
        const macroDoc = await pack.getDocument(macro._id);
        if (macroDoc) macroDoc.execute();
      }
    }
  } catch (err) {
    console.error('Error ejecutando macro de animación:', err);
  }
});

// Hook para MidiQOL
Hooks.on('midi-qol.RollComplete', async (workflow) => {
  if (!game.settings.get('animation-macro-creator', 'autoApplyAnimations')) return;

  try {
    const item = workflow.item;
    const macroName = `${item.name}_animation`;
    const pack = game.packs.get(game.settings.get('animation-macro-creator', 'defaultCompendium'));
    if (pack) {
      await pack.getIndex();
      const macro = pack.index.find(m => m.name === macroName);
      if (macro) {
        const macroDoc = await pack.getDocument(macro._id);
        if (macroDoc) {
          // Pasar contexto de MidiQOL al macro
          macroDoc.execute({
            workflow: workflow,
            actor: workflow.actor,
            token: workflow.token,
            targets: workflow.targets,
            item: item
          });
        }
      }
    }
  } catch (err) {
    console.error('Error ejecutando macro de animación MidiQOL:', err);
  }
});
// Helper para comparar valores en plantillas
Handlebars.registerHelper("ifEquals", function(a, b, options) {
  return (a === b) ? options.fn(this) : options.inverse(this);
});
