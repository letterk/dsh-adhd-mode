/**
 * dsh-i-have-adhd — client half.
 *
 * Renders the ADHD output-mode switch in two places and writes through to the
 * Host's volatile Config:
 *   - `settings.section`            → a full page ("页面显示")
 *   - `conversation.composer.dock`  → a compact pill next to the composer
 *
 * It talks to the Host only through documented client faces: `ctx.configForms`
 * for the Config value (`get(entryId)` + `getSnapshot`/`subscribe`/`set`),
 * `ctx.locale` for copy, `ctx.slots` for the seats. No Harness Client package
 * is required and no other plugin's DOM is touched.
 */
window.__ModuleLoader__.load({
  id: 'dsh-i-have-adhd',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const React = require('react');

    /** Must equal `NS` in index.js: locale namespace, settings namespace, slot id. */
    const NS = 'i-have-adhd';
    /** The Host plugin entry id (`cordis.patch.yml` row id) used by configForms.get(). */
    const ENTRY_ID = 'i-have-adhd';
    /** The single volatile Config field we expose. */
    const FIELD = 'enabled';

    // ----------------------------------------------------------------- styles
    const STYLE_TAG = 'dsh-i-have-adhd';

    // Locale dictionaries are Record<string, string>, so the rule list is held as
    // ten flat keys and assembled here.
    const RULE_KEYS = [
      'rule1',
      'rule2',
      'rule3',
      'rule4',
      'rule5',
      'rule6',
      'rule7',
      'rule8',
      'rule9',
      'rule10',
    ];

    const CSS = [
      '.dsh-adhd-pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;',
      'border:1px solid var(--dsw-alias-border-l1);border-radius:999px;',
      'background:var(--dsw-alias-bg-l1);color:var(--dsw-alias-label-secondary);',
      'font-size:12px;font-weight:500;line-height:1;cursor:pointer;user-select:none;',
      'transition:background-color .15s ease,color .15s ease,border-color .15s ease}',
      '.dsh-adhd-pill:hover{background:var(--dsw-alias-interactive-bg-active)}',
      '.dsh-adhd-pill[data-on="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.dsh-adhd-pill:disabled{opacity:.5;cursor:default}',
      '.dsh-adhd-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-dimmed);flex:0 0 auto}',
      '.dsh-adhd-pill[data-on="true"] .dsh-adhd-dot{background:var(--dsw-alias-brand-primary)}',

      '.dsh-adhd-page{display:flex;flex-direction:column;gap:16px;max-width:760px;padding:4px 0 24px}',
      '.dsh-adhd-page h2{margin:0;font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.dsh-adhd-lede{margin:0;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}',
      '.dsh-adhd-card{display:flex;align-items:center;justify-content:space-between;gap:16px;',
      'padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;',
      'background:var(--dsw-alias-bg-layer-1)}',
      '.dsh-adhd-card-text{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.dsh-adhd-card-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.dsh-adhd-card-hint{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',

      '.dsh-adhd-switch{position:relative;flex:0 0 auto;width:40px;height:22px;padding:0;border:none;',
      'border-radius:999px;background:var(--dsw-alias-border-l2);cursor:pointer;',
      'transition:background-color .15s ease}',
      '.dsh-adhd-switch[data-on="true"]{background:var(--dsw-alias-brand-primary)}',
      '.dsh-adhd-switch:disabled{opacity:.5;cursor:not-allowed}',
      '.dsh-adhd-switch::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;',
      'border-radius:50%;background:var(--dsw-alias-bg-l1);transition:transform .15s ease}',
      '.dsh-adhd-switch[data-on="true"]::after{transform:translateX(18px)}',

      '.dsh-adhd-state{font-size:12px;color:var(--dsw-alias-label-quaternary)}',
      '.dsh-adhd-note{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-error)}',
      '.dsh-adhd-rules{margin:0;padding:0 0 0 20px;display:flex;flex-direction:column;gap:6px}',
      '.dsh-adhd-rules li{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
    ].join('');

    function installStyle() {
      if (typeof document === 'undefined') return;
      const selector = 'style[data-plugin-css=' + JSON.stringify(STYLE_TAG) + ']';
      if (document.querySelector(selector) !== null) return;
      const tag = document.createElement('style');
      tag.setAttribute('data-plugin-css', STYLE_TAG);
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ---------------------------------------------------------------- locale
    const DICT = {
      zh: {
        title: 'ADHD 输出模式',
        lede: '开启后，回答会先给下一步动作、把多步任务编号、给出具体时间估计，并省略开场白和客套收尾。',
        switchLabel: '常驻启用',
        switchHint: '规则会作为系统提示词的一部分，对每一轮对话生效。',
        pillOn: 'ADHD 模式：开',
        pillOff: 'ADHD 模式：关',
        stateOn: '已开启',
        stateOff: '已关闭',
        loading: '读取中…',
        unavailable: '当前环境不支持修改，开关为只读。',
        memoryMode: '本次修改只对当前运行生效，未写入配置文件。',
        writeFailed: '写入配置失败，请稍后重试。',
        rulesTitle: '规则速览',
        rule1: '先给出下一步动作。',
        rule2: '多步任务要编号。',
        rule3: '结尾给一个具体的下一步动作。',
        rule4: '砍掉离题内容。',
        rule5: '每轮重申当前状态。',
        rule6: '时间估计要具体。',
        rule7: '已完成的工作要可见。',
        rule8: '报错时语气平实，不道歉。',
        rule9: '列表最多 5 条。',
        rule10: '不写开场白、不写回顾、不写客套收尾。',
        usageTitle: '开关在哪',
        usage:
          '两个地方：这一页，和输入框右侧的胶囊。改动立即生效，并写入配置长期保留。',
      },
      en: {
        title: 'ADHD output mode',
        lede: 'Turns answers action-first: the next step up front, numbered multi-step work, concrete time estimates, no preamble and no closing pleasantries.',
        switchLabel: 'Always on',
        switchHint: 'The ruleset rides the system prompt, so it applies to every turn.',
        pillOn: 'ADHD mode: on',
        pillOff: 'ADHD mode: off',
        stateOn: 'On',
        stateOff: 'Off',
        loading: 'Loading…',
        unavailable: 'This environment cannot change the setting; the switch is read-only.',
        memoryMode: 'This change applies to the current run only; nothing was written to config.',
        writeFailed: 'Could not write the setting. Try again.',
        rulesTitle: 'The rules',
        rule1: 'Lead with the next action.',
        rule2: 'Number multi-step tasks.',
        rule3: 'End with one concrete next action.',
        rule4: 'Suppress tangents.',
        rule5: 'Restate state every turn.',
        rule6: 'Give specific time estimates.',
        rule7: 'Make completed work visible.',
        rule8: 'Matter-of-fact tone for errors.',
        rule9: 'Cap lists to 5 items.',
        rule10: 'No preamble, no recap, no closing pleasantries.',
        usageTitle: 'Where the switch lives',
        usage:
          'Two places: this page, and the pill beside the composer. A flip applies immediately and is written to config.',
      },
    };

    // ------------------------------------------------------------ controller
    function ToggleController(ctx) {
      this.ctx = ctx;
      this.form = null;
      this.unsubscribe = null;
      this.listeners = new Set();
      this.lastError = '';
      this.state = {
        status: 'loading',
        value: undefined,
        revision: undefined,
        writable: false,
        mode: 'memory',
      };
      const self = this;
      this.subscribe = function subscribe(listener) {
        self.listeners.add(listener);
        return function unsubscribeOne() {
          self.listeners.delete(listener);
        };
      };
      this.getSnapshot = function getSnapshot() {
        return self.state;
      };
    }

    ToggleController.prototype.start = function start() {
      const self = this;
      this.form = this.ctx.configForms.get(ENTRY_ID);
      this.publish(this.form.getSnapshot());
      this.unsubscribe = this.form.subscribe(function onFormChange() {
        self.publish(self.form.getSnapshot());
      });
    };

    ToggleController.prototype.publish = function publish(snapshot) {
      this.state = snapshot && typeof snapshot === 'object' ? snapshot : this.state;
      this.listeners.forEach(function notify(listener) {
        listener();
      });
    };

    ToggleController.prototype.dispose = function dispose() {
      if (typeof this.unsubscribe === 'function') this.unsubscribe();
      this.unsubscribe = null;
      if (this.form && typeof this.form.dispose === 'function') this.form.dispose();
      this.form = null;
      this.listeners.clear();
    };

    ToggleController.prototype.isOn = function isOn() {
      const value = this.state.value;
      return Boolean(value && value[FIELD] === true);
    };

    ToggleController.prototype.canWrite = function canWrite() {
      return this.state.status === 'ready' && this.state.writable === true;
    };

    ToggleController.prototype.setEnabled = function setEnabled(next) {
      const self = this;
      if (!this.form || !this.canWrite()) {
        this.lastError = 'disabled';
        return Promise.resolve(false);
      }
      return this.form.set(FIELD, next).then(
        function ok() {
          self.lastError = '';
          return true;
        },
        function failed(error) {
          self.lastError = error && error.message ? error.message : String(error);
          return false;
        },
      );
    };

    // ------------------------------------------------------------ components
    function apply(ctx) {
      installStyle();

      ctx.effect(
        function () {
          return ctx.locale.register(NS, DICT);
        },
        'i-have-adhd: locale',
      );

      const t = ctx.locale.bind(NS);
      const controller = new ToggleController(ctx);
      controller.start();
      ctx.effect(
        function () {
          return function () {
            controller.dispose();
          };
        },
        'i-have-adhd: controller',
      );

      function useToggle() {
        return React.useSyncExternalStore(
          controller.subscribe,
          controller.getSnapshot,
          controller.getSnapshot,
        );
      }

      function Switch(props) {
        return React.createElement(
          'button',
          {
            type: 'button',
            className: 'dsh-adhd-switch',
            role: 'switch',
            'aria-checked': props.on ? 'true' : 'false',
            'aria-label': props.label,
            title: props.label,
            'data-on': props.on ? 'true' : 'false',
            disabled: props.disabled ? true : undefined,
            onClick: function onClick() {
              props.onToggle(!props.on);
            },
          },
        );
      }

      /** Compact seat: `conversation.composer.dock`. */
      function Pill() {
        const snapshot = useToggle();
        const unwritable = snapshot.status === 'unavailable';
        const on = Boolean(snapshot.value && snapshot.value[FIELD] === true);
        const label = on ? t('pillOn') : t('pillOff');
        return React.createElement(
          'button',
          {
            type: 'button',
            className: 'dsh-adhd-pill',
            'data-on': on ? 'true' : 'false',
            title: t('switchHint'),
            'aria-label': label,
            'aria-pressed': on ? 'true' : 'false',
            onClick: function onClick() {
              controller.setEnabled(!on);
            },
          },
          React.createElement('span', { className: 'dsh-adhd-dot' }),
          React.createElement('span', null, label),
        );
      }

      /** Full page: `settings.section`. */
      function Page() {
        const snapshot = useToggle();
        const on = Boolean(snapshot.value && snapshot.value[FIELD] === true);
        const ready = snapshot.status === 'ready';
        const writable = ready && snapshot.writable === true;
        const failed = controller.lastError !== '' && controller.lastError !== 'disabled';

        const stateLine = !ready
          ? snapshot.status === 'unavailable'
            ? t('unavailable')
            : t('loading')
          : on
            ? t('stateOn')
            : t('stateOff');

        const rules = RULE_KEYS.map(function readRule(key) {
          return t(key);
        }).filter(Boolean);

        return React.createElement(
          'section',
          { className: 'dsh-adhd-page' },
          React.createElement('h2', null, t('title')),
          React.createElement('p', { className: 'dsh-adhd-lede' }, t('lede')),

          React.createElement(
            'div',
            { className: 'dsh-adhd-card' },
            React.createElement(
              'div',
              { className: 'dsh-adhd-card-text' },
              React.createElement('span', { className: 'dsh-adhd-card-title' }, t('switchLabel')),
              React.createElement('span', { className: 'dsh-adhd-card-hint' }, t('switchHint')),
              React.createElement('span', { className: 'dsh-adhd-state' }, stateLine),
              snapshot.mode === 'memory' && writable
                ? React.createElement('span', { className: 'dsh-adhd-state' }, t('memoryMode'))
                : null,
              failed ? React.createElement('span', { className: 'dsh-adhd-note' }, t('writeFailed')) : null,
            ),
            React.createElement(Switch, {
              on: on,
              disabled: !writable,
              label: t('switchLabel'),
              onToggle: function onToggle(next) {
                controller.setEnabled(next);
              },
            }),
          ),

          React.createElement('h2', null, t('rulesTitle')),
          React.createElement(
            'ol',
            { className: 'dsh-adhd-rules' },
            rules.map(function renderRule(rule, index) {
              return React.createElement('li', { key: 'rule-' + index }, rule);
            }),
          ),

          React.createElement('h2', null, t('usageTitle')),
          React.createElement('p', { className: 'dsh-adhd-lede' }, t('usage')),
        );
      }

      ctx.effect(
        function () {
          return ctx.slots.inject('conversation.composer.dock', function () {
            return ctx.slots.register(
              { name: 'conversation.composer.dock', id: NS, order: 20 },
              Pill,
            );
          });
        },
        'i-have-adhd: composer pill',
      );

      ctx.effect(
        function () {
          return ctx.slots.inject('settings.section', function () {
            return ctx.slots.register(
              {
                name: 'settings.section',
                id: NS,
                order: 14,
                label: function label() {
                  return t('title');
                },
              },
              Page,
            );
          });
        },
        'i-have-adhd: settings page',
      );
    }

    exports.NS = NS;
    exports.apply = apply;
    exports.inject = ['slots', 'locale', 'configForms'];
    return module.exports;
  },
});
