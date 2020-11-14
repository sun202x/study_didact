const ENOUGH_TIME = 1; // 밀리세컨드

let workQueue = [];
let nextUnitOfWork = null; // 다음 작업 단위

function schedule(task) {
    workQueue.push(task);
    requestIdleCallback(performWork);
}

function performWork(deadline) {
    if (!nextUnitOfWork) {
        nextUnitOfWork = workQueue.shift();
    }

    while (nextUnitOfWork && deadline.timeRemaining() > ENOUGH_TIME) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    }

    if (nextUnitOfWork || workQueue.length > 0) {
        requestIdleCallback(performWork);
    }
}