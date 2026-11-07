(() => {
  'use strict';

  const STORAGE_KEY = 'focus-todo:v1';
  const MAX_LENGTH = 1000;
  const byId = (id) => document.getElementById(id);
  const form = byId('task-form');
  const input = byId('task-input');
  const list = byId('task-list');
  const template = byId('task-template');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  let filter = 'all';
  let storageBlocked = false;
  let tasks = loadTasks();

  function showStorageWarning(message) {
    byId('storage-warning').textContent = message;
    byId('storage-warning').hidden = false;
    byId('save-status').textContent = 'Сохранение недоступно';
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return [];
      const saved = JSON.parse(raw);
      const ids = new Set();
      if (!Array.isArray(saved) || !saved.every((task) => {
        if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id) ||
            typeof task.text !== 'string' || !task.text.trim() || task.text.length > MAX_LENGTH ||
            typeof task.completed !== 'boolean') return false;
        ids.add(task.id);
        return true;
      })) throw new Error('Invalid saved tasks');
      return saved.map(({ id, text, completed }) => ({ id, text, completed }));
    } catch {
      // Keep unreadable data intact: this session must not overwrite it.
      storageBlocked = true;
      showStorageWarning('Не удалось прочитать сохранённые задачи. Исходные данные не изменены. Новые задачи доступны только до закрытия или обновления страницы. Проверьте доступ браузера к хранилищу.');
      return [];
    }
  }

  function saveTasks() {
    if (storageBlocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      byId('storage-warning').hidden = true;
      byId('save-status').textContent = 'Все изменения сохранены';
    } catch {
      showStorageWarning('Не удалось сохранить изменения в браузере. Задачи остаются на этой странице, но могут потеряться после обновления. Возможно, хранилище заполнено или недоступно.');
    }
  }

  function announce(message) {
    byId('announcer').textContent = message;
  }

  function activeLabel(count) {
    const last = count % 10;
    const lastTwo = count % 100;
    if (last === 1 && lastTwo !== 11) return `${count} активная задача`;
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} активные задачи`;
    return `${count} активных задач`;
  }

  function render() {
    const completed = tasks.filter((task) => task.completed).length;
    const active = tasks.length - completed;
    const percent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
    byId('side-count').textContent = active;
    byId('count-all').textContent = tasks.length;
    byId('count-active').textContent = active;
    byId('count-completed').textContent = completed;
    byId('active-summary').textContent = active ? activeLabel(active) : 'Нет активных задач';
    byId('progress-percent').firstChild.textContent = percent;
    byId('progress').value = percent;
    byId('progress').textContent = `${percent}%`;
    byId('progress').setAttribute('aria-valuetext', `Выполнено ${completed} из ${tasks.length}`);
    byId('completed-count').textContent = `Выполнено ${completed} из ${tasks.length}`;
    byId('progress-caption').textContent = !tasks.length ? 'Начните с одной небольшой задачи' : active ? 'Каждое выполненное дело — шаг вперёд' : 'Всё готово. Можно немного выдохнуть';
    byId('encouragement').textContent = completed ? 'Хороший темп. Продолжайте.' : 'Маленький шаг — уже начало';

    filterButtons.forEach((button) => {
      const selected = button.dataset.filter === filter;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const visible = tasks.filter((task) => filter === 'all' || (filter === 'completed' ? task.completed : !task.completed));
    const fragment = document.createDocumentFragment();
    visible.forEach((task) => {
      const row = template.content.firstElementChild.cloneNode(true);
      row.dataset.id = task.id;
      row.classList.toggle('is-completed', task.completed);
      row.querySelector('input').checked = task.completed;
      // User content is always text, never HTML.
      row.querySelector('.task-text').textContent = task.text;
      row.querySelector('button').setAttribute('aria-label', `Удалить задачу: ${task.text}`);
      row.querySelector('button').title = 'Удалить задачу';
      fragment.append(row);
    });
    list.replaceChildren(fragment);
    byId('empty-state').hidden = visible.length > 0;
    const emptyCopy = !tasks.length
      ? ['Место для ваших планов', 'Добавьте первую задачу.\nБольшего для начала не нужно.']
      : filter === 'active'
        ? ['Всё сделано. Отличная работа!', 'Активных задач пока нет.\nМожно выдохнуть или записать новый план.']
        : ['Первые победы ещё впереди', 'Отметьте выполненную задачу —\nона появится здесь.'];
    byId('empty-title').textContent = emptyCopy[0];
    byId('empty-description').textContent = emptyCopy[1];
    byId('empty-description').style.whiteSpace = 'pre-line';
    byId('empty-action').hidden = tasks.length > 0;
  }

  function commit(message) {
    saveTasks();
    render();
    announce(message);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.replace(/\s+/g, ' ').trim();
    if (!text || text.length > MAX_LENGTH) {
      byId('input-error').textContent = !text ? 'Сначала напишите, что нужно сделать.' : `Сократите задачу до ${MAX_LENGTH} символов.`;
      byId('input-error').hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    tasks.push({ id, text, completed: false });
    // Show the added task even when the completed filter was selected.
    if (filter === 'completed') filter = 'all';
    input.value = '';
    clearInputError();
    commit('Задача добавлена.');
    input.focus();
  });

  function clearInputError() {
    byId('input-error').hidden = true;
    input.removeAttribute('aria-invalid');
  }
  input.addEventListener('input', clearInputError);
  byId('empty-action').addEventListener('click', () => input.focus());

  filterButtons.forEach((button) => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    render();
    announce(`Фильтр: ${button.firstChild.textContent.trim()}. Показано задач: ${list.children.length}.`);
  }));

  // Restore keyboard focus after rendering or removing the focused row.
  function restoreFocus(id, index, selector) {
    const rows = [...list.children];
    const row = rows.find((item) => item.dataset.id === id) || rows[Math.min(index, rows.length - 1)];
    if (row) row.querySelector(selector).focus();
    else filterButtons.find((button) => button.dataset.filter === filter).focus();
  }

  list.addEventListener('change', (event) => {
    if (!event.target.matches('input[type="checkbox"]')) return;
    const row = event.target.closest('.task-row');
    const index = [...list.children].indexOf(row);
    const task = tasks.find((item) => item.id === row.dataset.id);
    task.completed = event.target.checked;
    commit(task.completed ? 'Задача выполнена.' : 'Задача снова активна.');
    restoreFocus(task.id, index, 'input');
  });

  list.addEventListener('click', (event) => {
    const button = event.target.closest('.delete-button');
    if (!button) return;
    const row = button.closest('.task-row');
    const index = [...list.children].indexOf(row);
    tasks = tasks.filter((task) => task.id !== row.dataset.id);
    commit('Задача удалена.');
    restoreFocus(null, index, 'button');
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    storageBlocked = false;
    byId('storage-warning').hidden = true;
    byId('save-status').textContent = 'Сохраняется автоматически';
    tasks = loadTasks();
    render();
    announce('Список обновлён из другой вкладки.');
  });

  render();
})();
