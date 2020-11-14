// let fiber = {
//     tag: HOST_COMPONENT,
//     type: "div",

//     // tree를 서술하기 위해 parent, child, sibling 프로퍼티를 사용한다.
//     parent: parentFiber,
//     child: childFiber,
//     sibling: null,

//     alternate: currentFiber,

//     // DOM element이거나 사용자 정의 class component일 수 있다.
//     stateNode: document.createElement("div"),
//     props: { children: [], className: "foo" },
//     partialState: null,
//     effectTag: PLACEMENT,
//     effects: []
// };

// 파이버 태그들
const HOST_COMPONENT = "host";
const CLASS_COMPONENT = "class";
const HOST_ROOT = "root";

// 전역 상태
const updateQueue = []; // 보류중인 업데이트를 추적한다.
let nextUnitOfWork = null; // 다음작업단위
let pendingCommit = null;

// 그냥 단순히 updateQueue에 집어넣는다1
function render(elements, containerDom) {
    updateQueue.push({
        from: HOST_ROOT,
        dom: containerDom,
        newProps: { children: elements }
    });
    requestIdleCallback(performWork);
}

// 그냥 단순히 updateQueue에 집어넣는다2
function scheduleUpdate(instance, partialState) {
    updateQueue.push({
        from: CLASS_COMPONENT,
        instance: instance,
        partialState: partialState
    });
    requestIdleCallback(performWork);
}

const ENOUGH_TIME = 1; // milliseconds

function performWork(deadline) {
    // deadline을 받아 workLoop 호출
    workLoop(deadline);

    // workLoop 호출후 남아있는 작업이 있는지 확인 후 시로운 지연호출을 자체적으로 실행
    if (nextUnitOfWork || updateQueue.length > 0) {
        requestIdleCallback(performWork);
    }
}

function workLoop(deadline) {
    if (!nextUnitOfWork) {
        resetNextUnitOfWork();
    }

    // dealine이 가까워질 경우 중단하고 nextUnitOfWork를 업데이트한다.
    while (nextUnitOfWork && deadline.timeRemaining() > ENOUGH_TIME) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    }
    if (pendingCommit) {
        commitAllWork(pendingCommit);
    }
}

// 다음 작업 단위 재설정
function resetNextUnitOfWork() {
    const update = updateQueue.shift();
    if (!update) {
        return;
    }

    // 업데이트 페이로드에서 해당 파이버로 setState 매개 변수 복사
    if (update.partialState) {
        update.instance.__fiber.partialState = update.partialState;
    }

    const root =
        update.from == HOST_ROOT
            ? update.dom._rootContainerFiber
            : getRoot(update.instance.__fiber);

    // new work-in-progress 트리의 루트
    nextUnitOfWork = {
        tag: HOST_ROOT,
        stateNode: update.dom || root.stateNode,
        props: update.newProps || root.props,
        alternate: root
    };
}

function getRoot(fiber) {
    let node = fiber;
    while (node.parent) {
        node = node.parent;
    }
    return node;
}

function performUnitOfWork(wipFiber) {
    beginWork(wipFiber);
    if (wipFiber.child) {
        return wipFiber.child;
    }

    // 자식이 없는 경우 형제(sibling)를 찾기 전까지 completeWork를 호출합니다.
    let uow = wipFiber;
    while (uow) {
        completeWork(uow);
        if (uow.sibling) {
            // Sibling needs to beginWork
            return uow.sibling;
        }
        uow = uow.parent;
    }
}

// 1. stateNoe가 없다면 생성
// 2. 컴포넌트 자식들을 가져와 reconcileChildrenArray()로 넘겨준다.
function beginWork(wipFiber) {
    if (wipFiber.tag == CLASS_COMPONENT) {
        updateClassComponent(wipFiber);
    } else {
        updateHostComponent(wipFiber);
    }
}

// host, root 컴포넌트를 다룬다.
// 다음 파이버 props의 자식 엘리먼트를 사용하여 reconcileChildrenArray()를 호출
function updateHostComponent(wipFiber) {
    if (!wipFiber.stateNode) {
        wipFiber.stateNode = createDomElement(wipFiber);
    }
    const newChildElements = wipFiber.props.children;
    reconcileChildrenArray(wipFiber, newChildElements);
}

// 이 인스턴스의 props와 state가 업데이트 되면 render() 함수를 호추랗여 새로운 자식 추가
function updateClassComponent(wipFiber) {
    let instance = wipFiber.stateNode;
    if (instance == null) {
        // 클래스 생성자 호출
        instance = wipFiber.stateNode = createInstance(wipFiber);
    } else if (wipFiber.props == instance.props && !wipFiber.partialState) {
        // 지난번에 복제한 자식을, 랜더링 할 필요가 없습니다.
        cloneChildFibers(wipFiber);
        return;
    }

    instance.props = wipFiber.props;
    instance.state = Object.assign({}, instance.state, wipFiber.partialState);
    wipFiber.partialState = null;

    const newChildElements = wipFiber.stateNode.render();
    reconcileChildrenArray(wipFiber, newChildElements);
}

// Effect tags
const PLACEMENT = 1;
const DELETION = 2;
const UPDATE = 3;

function arrify(val) {
    return val == null ? [] : Array.isArray(val) ? val : [val];
}

function reconcileChildrenArray(wipFiber, newChildElements) {
    const elements = arrify(newChildElements);

    let index = 0;
    let oldFiber = wipFiber.alternate ? wipFiber.alternate.child : null;
    let newFiber = null;
    while (index < elements.length || oldFiber != null) {
        const prevFiber = newFiber;
        const element = index < elements.length && elements[index];
        const sameType = oldFiber && element && element.type == oldFiber.type;

        if (sameType) {
            newFiber = {
                type: oldFiber.type,
                tag: oldFiber.tag,
                stateNode: oldFiber.stateNode,
                props: element.props,
                parent: wipFiber,
                alternate: oldFiber,
                partialState: oldFiber.partialState,
                effectTag: UPDATE
            };
        }

        if (element && !sameType) {
            newFiber = {
                type: element.type,
                tag:
                    typeof element.type === "string" ? HOST_COMPONENT : CLASS_COMPONENT,
                props: element.props,
                parent: wipFiber,
                effectTag: PLACEMENT
            };
        }

        if (oldFiber && !sameType) {
            oldFiber.effectTag = DELETION;
            wipFiber.effects = wipFiber.effects || [];
            wipFiber.effects.push(oldFiber);
        }

        if (oldFiber) {
            oldFiber = oldFiber.sibling;
        }

        if (index == 0) {
            wipFiber.child = newFiber;
        } else if (prevFiber && element) {
            prevFiber.sibling = newFiber;
        }

        index++;
    }
}