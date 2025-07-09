class AnimationMacroCreator extends Application {
  constructor() {
    super();
    this.animationLibrary = new AnimationLibrary();
    this.compendiumManager = new CompendiumManager();
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'animation-macro-creator',
      title: 'Creador de Macros de Animación',
      template: 'modules/animation-macro-creator/templates/macro-creator.html',
      width: 800,
      height: 600,
      resizable: true,
      tabs: [
        {
          navSelector: '.tabs',
          contentSelector: '.tab-content',
          initial: 'animations'
        }
      ]
    });
  }

  getData() {
    return {
      animations: this.animationLibrary.getAnimations(),
      transformations: this.animationLibrary.getTransformations(),
      items: this.getAvailableItems(),
      spells: this.getAvailableSpells(),
      compendiums: this.getAvailableCompendiums()
    };
  }

  getAvailableItems() {
    const items = [];
    game.actors.forEach(actor => {
      if (actor.items) {
        actor.items.forEach(item => {
          if (!items.find(i => i.name === item.name)) {
            items.push({
              id: item.id,
              name: item.name,
              type: item.type,
              actorId: actor.id
            });
          }
        });
      }
    });
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  getAvailableSpells() {
    const spells = [];
    game.actors.forEach(actor => {
      if (actor.items) {
        actor.items.filter(item => item.type === 'spell').forEach(spell => {
          if (!spells.find(s => s.name === spell.name)) {
            spells.push({
              id: spell.id,
              name: spell.name,
              level: spell.system.level,
              school: spell.system.school,
              actorId: actor.id
            });
          }
        });
      }
    });
    return spells.sort((a, b) => a.name.localeCompare(b.name));
  }

  getAvailableCompendiums() {
    return game.packs.filter(pack => pack.documentName === 'Macro').map(pack => ({
      id: pack.collection,
      name: pack.title
    }));
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Previsualizar animación
    html.find('.preview-animation').click(this._onPreviewAnimation.bind(this));
    
    // Crear macro
    html.find('.create-macro').click(this._onCreateMacro.bind(this));
    
    // Aplicar transformación
    html.find('.apply-transformation').click(this._onApplyTransformation.bind(this));
    
    // Guardar en compendio
    html.find('.save-to-compendium').click(this._onSaveToCompendium.bind(this));
    
    // Actualizar preview cuando cambien los parámetros
    html.find('input, select').change(this._updatePreview.bind(this));
  }

  async _onPreviewAnimation(event) {
    const target = canvas.tokens.controlled[0];
    if (!target) {
      ui.notifications.warn('Selecciona un token para previsualizar');
      return;
    }

    const animationType = event.currentTarget.dataset.animation;
    const animation = this.animationLibrary.getAnimation(animationType);
    
    if (animation) {
      await this._executeAnimation(animation, target);
    }
  }

  async _onCreateMacro(event) {
    const html = this.element;
    const form = html.find('form')[0];
    if (!form) {
      ui.notifications.error('No se encontró el formulario para crear macro');
      return null;
    }
    const formData = new FormData(form);

    const macroData = {
      name: formData.get('macroName') || 'Nuevo Macro de Animación',
      type: 'script',
      scope: 'global',
      command: this._generateMacroCommand(formData),
      img: formData.get('macroIcon') || 'icons/svg/aura.svg',
      folder: null
    };

    try {
      const macro = await Macro.create(macroData);
      ui.notifications.info(`Macro "${macro.name}" creado exitosamente`);
      return macro;
    } catch (err) {
      ui.notifications.error('Error creando macro');
      console.error(err);
      return null;
    }
  }

  _generateMacroCommand(formData) {
    const animationType = formData.get('animationType');
    const targetType = formData.get('targetType');
    const itemName = formData.get('itemName');
    const transformations = this._getSelectedTransformations(formData);

    let command = `
// Macro generado por Animation Macro Creator
const targets = canvas.tokens.controlled;
if (targets.length === 0) {
  ui.notifications.warn('Selecciona un token');
  return;
}
const target = targets[0];
`;

    // Agregar animación
    if (animationType && animationType !== 'none') {
      const animation = this.animationLibrary.getAnimation(animationType);
      if (animation) {
        command += `
// Ejecutar animación
${this._generateAnimationCode(animation, formData)}
`;
      }
    }

    // Agregar transformaciones
    if (transformations.length > 0) {
      command += `
// Aplicar transformaciones
${this._generateTransformationCode(transformations, formData)}
`;
    }

    // Si está asociado a un item/spell
    if (itemName) {
      command += `
// Asociado al item: ${itemName}
`;
    }

    return command;
  }

  _generateAnimationCode(animation, formData) {
    const scale = Number(formData.get('scale')) || 1;
    const duration = Number(formData.get('duration')) || 1000;
    const color = formData.get('color') || '#ffffff';

    return `
new Sequence()
  .effect()
    .file("${animation.file}")
    .atLocation(target)
    .scale(${scale})
    .duration(${duration})
    .tint("${color}")
    .play();
`;
  }

  _generateTransformationCode(transformations, formData) {
    let code = '';
    transformations.forEach(transform => {
      switch (transform.type) {
        case 'scale':
          code += `
// Cambiar escala
await target.document.update({
  "texture.scaleX": ${transform.value},
  "texture.scaleY": ${transform.value}
});
`;
          break;
        case 'tint':
          code += `
// Cambiar tinte
await target.document.update({
  "texture.tint": "${transform.value}"
});
`;
          break;
        case 'rotation':
          code += `
// Rotar token
await target.document.update({
  "rotation": ${transform.value}
});
`;
          break;
        case 'elevation':
          code += `
// Cambiar elevación
await target.document.update({
  "elevation": ${transform.value}
});
`;
          break;
        case 'visibility':
          code += `
// Cambiar visibilidad
await target.document.update({
  "hidden": ${transform.value}
});
`;
          break;
      }
    });
    return code;
  }

  _getSelectedTransformations(formData) {
    const transformations = [];
    // Revisar cada tipo de transformación
    if (formData.get('enableScale')) {
      transformations.push({
        type: 'scale',
        value: Number(formData.get('scaleValue')) || 1
      });
    }
    if (formData.get('enableTint')) {
      transformations.push({
        type: 'tint',
        value: formData.get('tintValue') || '#ffffff'
      });
    }
    if (formData.get('enableRotation')) {
      transformations.push({
        type: 'rotation',
        value: Number(formData.get('rotationValue')) || 0
      });
    }
    if (formData.get('enableElevation')) {
      transformations.push({
        type: 'elevation',
        value: Number(formData.get('elevationValue')) || 0
      });
    }
    if (formData.get('enableVisibility')) {
      transformations.push({
        type: 'visibility',
        value: formData.get('visibilityValue') === 'true'
      });
    }
    return transformations;
  }

  async _onApplyTransformation(event) {
    const targets = canvas.tokens.controlled;
    if (!targets.length) {
      ui.notifications.warn('Selecciona al menos un token');
      return;
    }
    const transformationType = event.currentTarget.dataset.transformation;
    const transformation = this.animationLibrary.getTransformation
      ? this.animationLibrary.getTransformation(transformationType)
      : this.animationLibrary.transformations[transformationType];
    if (transformation) {
      for (const target of targets) {
        await this._executeTransformation(transformation, target);
      }
    }
  }

  async _onSaveToCompendium(event) {
    const html = this.element;
    const selectedCompendium = html.find('select[name="compendium"]').val();
    if (!selectedCompendium) {
      ui.notifications.warn('Selecciona un compendio');
      return;
    }
    const macro = await this._onCreateMacro(event);
    if (macro) {
      try {
        await this.compendiumManager.saveMacroToCompendium(macro, selectedCompendium);
        ui.notifications.info(`Macro guardado en ${selectedCompendium}`);
      } catch (err) {
        ui.notifications.error('Error guardando macro en compendio');
        console.error(err);
      }
    }
  }

  async _executeAnimation(animation, target) {
    try {
      new Sequence()
        .effect()
          .file(animation.file)
          .atLocation(target)
          .scale(animation.scale || 1)
          .duration(animation.duration || 1000)
          .play();
    } catch (error) {
      console.error('Error ejecutando animación:', error);
      ui.notifications.error('Error ejecutando animación');
    }
  }

  async _executeTransformation(transformation, target) {
    try {
      const updates = {};
      switch (transformation.type) {
        case 'scale':
          updates['texture.scaleX'] = transformation.value;
          updates['texture.scaleY'] = transformation.value;
          break;
        case 'tint':
          updates['texture.tint'] = transformation.value;
          break;
        case 'rotation':
          updates['rotation'] = transformation.value;
          break;
        case 'elevation':
          updates['elevation'] = transformation.value;
          break;
        case 'visibility':
          updates['hidden'] = transformation.value;
          break;
      }
      await target.document.update(updates);
    } catch (error) {
      console.error('Error ejecutando transformación:', error);
      ui.notifications.error('Error ejecutando transformación');
    }
  }

  _updatePreview(event) {
    // Actualizar preview en tiempo real
    const html = this.element;
    const previewArea = html.find('.preview-area');
    // Aquí puedes agregar lógica para mostrar un preview visual
    // de cómo se verá la animación/transformación
  }
}