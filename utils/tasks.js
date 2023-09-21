const TASK_LIMIT = 1;

let currentTaskCount = 0;

/** @type {Function[]} */
const pendingTaskResolves = [];

/**
 * @template {any} T
 * @param {T} task
 * @return {ReturnType<T>}
 */
export async function waitForTask(task) {
  if (currentTaskCount >= TASK_LIMIT) {
    // console.log('tasks busy, queuing');
    await new Promise((resolve) => {
      pendingTaskResolves.push(resolve);
    });
    // console.log('allowed by queue');
  } else {
    currentTaskCount++;
  }
  let result;
  try {
    result = await task();
  } finally {
    currentTaskCount--;
    // Unlock usage
    while (currentTaskCount < TASK_LIMIT && pendingTaskResolves.length) {
      // console.log('signaling next queued task');
      currentTaskCount++;
      const nextResolve = pendingTaskResolves.shift();
      nextResolve();
    }
  }
  return result;
}
