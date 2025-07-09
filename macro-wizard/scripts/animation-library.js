/**
 * AnimationLibrary.js - Advanced animation management for FoundryVTT
 * Handles loading, categorization, and transformation of animations
 */

class AnimationLibrary {
  constructor() {
    this.animations = {};
    this.transformations = this._initializeTransformations();
    this.sequencerDatabase = null;
    this._loadSequencerDatabase();
    this._setupHooks();
  }

  async _loadSequencerDatabase() {
    if (!game.modules.get('sequencer')?.active) {
      console.warn("Animation Library | Sequencer module not active");
      return;
    }
    // Esperar a que Sequencer.Database esté disponible
    if (!Sequencer?.Database) {
      Hooks.once('sequencerReady', () => this._loadSequencerDatabase());
      return;
    }
    this.sequencerDatabase = Sequencer.Database;
    this._processAnimations();
    console.log('Animation Library | Sequencer database loaded');
  }

  _setupHooks() {
    // Refresh when new animation packs are added
    Hooks.on('sequencerDatabaseReady', () => this.refreshDatabase());
    // Watch for JB2A updates specifically
    Hooks.on('jb2aReady', () => this.refreshDatabase());
  }

  _processAnimations() {
    this.animations = {};
    if (!this.sequencerDatabase) return;

    const allEntries = this.sequencerDatabase.getAllEntries();

    // Process each animation entry
    Object.entries(allEntries).forEach(([path, data]) => {
      if (!data.file) return;

      const category = this._determineCategory(path);
      const variant = this._determineVariant(path);
      const tags = this._generateTags(path);

      this.animations[path] = {
        name: this._formatName(path),
        file: data.file,
        category,
        variant,
        tags,
        path,
        metadata: {
          scale: data.scale || 1,
          duration: data.duration || this._estimateDuration(path),
          source: this._determineSource(path),
          ...(data.metadata || {})
        }
      };
    });

    // Create category index
    this._buildCategoryIndex();
  }

  _determineCategory(path) {
    const categoryMap = {
      weapons: ['melee', 'weapon', 'sword', 'axe', 'dagger', 'arrow', 'bolt', 'throw'],
      spells: ['magic_missile', 'fireball', 'lightning', 'healing', 'sacred_flame'],
      defense: ['shield', 'armor', 'barrier', 'wall'],
      movement: ['misty_step', 'teleport', 'dash', 'fly'],
      environment: ['darkness', 'light', 'fog', 'smoke'],
      buffs: ['bless', 'haste', 'inspiration', 'guidance'],
      debuffs: ['curse', 'poison', 'fear', 'charm'],
      elemental: ['fire', 'ice', 'lightning', 'earth', 'water', 'air'],
      necromancy: ['skull', 'bone', 'death', 'undead'],
      divine: ['divine', 'radiant', 'celestial', 'angel']
    };

    const lowerPath = path.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(keyword => lowerPath.includes(keyword))) {
        return category;
      }
    }
    
    return 'misc';
  }

  _determineVariant(path) {
    const parts = path.split('.');
    const variantPart = parts.find(part => 
      ['red', 'blue', 'green', 'purple', 'yellow', 'white', 'black'].includes(part.toLowerCase())
    );
    return variantPart || 'default';
  }

  _generateTags(path) {
    const tags = [];
    const lowerPath = path.toLowerCase();

    // Damage types
    const damageTypes = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 
                        'lightning', 'necrotic', 'piercing', 'poison', 
                        'psychic', 'radiant', 'slashing', 'thunder'];
    tags.push(...damageTypes.filter(type => lowerPath.includes(type)));

    // Animation properties
    if (lowerPath.includes('loop')) tags.push('loop');
    if (lowerPath.includes('explosion')) tags.push('explosion');
    if (lowerPath.includes('projectile')) tags.push('projectile');
    if (lowerPath.includes('persistent')) tags.push('persistent');

    return tags;
  }

  _formatName(path) {
    const parts = path.split('.');
    const lastPart = parts[parts.length - 1];
    return lastPart
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  _determineSource(path) {
    if (path.includes('jb2a')) return 'JB2A';
    if (path.includes('fxmaster')) return 'FXMaster';
    if (path.includes('animated-spell-effects')) return 'ASE';
    return 'Custom';
  }

  _estimateDuration(path) {
    const lowerPath = path.toLowerCase();
    
    const durationMap = {
      explosion: 2000,
      projectile: 1500,
      melee: 800,
      shield: 1200,
      healing: 2500,
      curse: 2000,
      teleport: 1800,
      lightning: 1000,
      fire: 3000,
      ice: 2200
    };

    for (const [keyword, duration] of Object.entries(durationMap)) {
      if (lowerPath.includes(keyword)) return duration;
    }
    
    return 1500; // Default duration
  }

  _buildCategoryIndex() {
    this.categoryIndex = {};
    Object.entries(this.animations).forEach(([path, anim]) => {
      if (!this.categoryIndex[anim.category]) {
        this.categoryIndex[anim.category] = [];
      }
      this.categoryIndex[anim.category].push(path);
    });
  }

  // Public API Methods

  getAnimations(filter = {}) {
    if (!Object.keys(filter).length) return this.animations;

    return Object.fromEntries(
      Object.entries(this.animations).filter(([path, anim]) => {
        return Object.entries(filter).every(([key, value]) => {
          if (key === 'category') return anim.category === value;
          if (key === 'variant') return anim.variant === value;
          if (key === 'tag') return anim.tags.includes(value);
          if (key === 'source') return anim.metadata.source === value;
          if (key === 'search') {
            const searchTerm = value.toLowerCase();
            return anim.name.toLowerCase().includes(searchTerm) || 
                   path.toLowerCase().includes(searchTerm);
          }
          return true;
        });
      })
    );
  }

  getAnimation(path) {
    return this.animations[path] || null;
  }

  getCategories() {
    return Object.keys(this.categoryIndex || {});
  }

  getAnimationsByCategory(category) {
    return this.categoryIndex?.[category]?.reduce((acc, path) => {
      acc[path] = this.animations[path];
      return acc;
    }, {}) || {};
  }

  getVariantsForAnimation(basePath) {
    const baseParts = basePath.split('.');
    const searchBase = baseParts.slice(0, -1).join('.');
    return Object.entries(this.animations)
      .filter(([path]) => path.startsWith(searchBase))
      .reduce((acc, [path, anim]) => {
        acc[path] = anim;
        return acc;
      }, {});
  }

  getTransformations() {
    return this.transformations;
  }

  // Permite obtener una transformación por id
  getTransformation(id) {
    return this.transformations[id] || null;
  }

  applyTransformation(token, transformationId) {
    const transform = this.transformations[transformationId];
    if (!transform) return false;
    switch (transform.type) {
      case 'scale':
        token.document.update({ scale: transform.value });
        break;
      case 'tint':
        token.document.update({ tint: transform.value });
        break;
      case 'alpha':
        token.document.update({ alpha: transform.value });
        break;
      case 'rotation':
        token.document.update({ rotation: transform.value });
        break;
      case 'elevation':
        token.document.update({ elevation: transform.value });
        break;
      case 'visibility':
        token.document.update({ hidden: transform.value });
        break;
    }
    return true;
  }

  refreshDatabase() {
    if (this.sequencerDatabase) {
      this._processAnimations();
      console.log('Animation Library | Database refreshed');
      Hooks.callAll('animationLibraryRefreshed');
    }
  }

  _initializeTransformations() {
    // Transformation presets remain the same as original
    // ... (include all the transformation objects from original)
    // Si transformationPresets no está definido, inicializarlo aquí:
    const transformationPresets = {
      scaleUp: { type: 'scale', value: 1.5 },
      scaleDown: { type: 'scale', value: 0.5 },
      tintRed: { type: 'tint', value: '#ff0000' },
      tintBlue: { type: 'tint', value: '#0000ff' },
      rotate90: { type: 'rotation', value: 90 },
      rotate180: { type: 'rotation', value: 180 },
      elevate10: { type: 'elevation', value: 10 },
      hide: { type: 'visibility', value: true },
      show: { type: 'visibility', value: false }
    };
    return transformationPresets;
  }
}

// Singleton instance
let animationLibraryInstance = null;

export function getAnimationLibrary() {
  if (!animationLibraryInstance) {
    animationLibraryInstance = new AnimationLibrary();
  }
  return animationLibraryInstance;
}