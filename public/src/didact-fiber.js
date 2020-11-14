/** @jsx Didact.createElement */
const Didact = importFromBelow();

const stories = [
    { name: "Didact introduction", url: "http://bit.ly/2pX7HNn" },
    { name: "Rendering DOM elements ", url: "http://bit.ly/2qCOejH" },
    { name: "Element creation and JSX", url: "http://bit.ly/2qGbw8S" },
    { name: "Instances and reconciliation", url: "http://bit.ly/2q4A746" },
    { name: "Components and state", url: "http://bit.ly/2rE16nh" },
    { name: "Fiber: Incremental reconciliation", url: "http://bit.ly/2gaF1sS" }
];

class App extends Didact.Component {
    render() {
        return (
            <div>
                <h1>Didact Stories</h1>
                <ul>
                    {this.props.stories.map(story => {
                        return <Story name={story.name} url={story.url} />;
                    })}
                </ul>
            </div>
        );
    }
}

class Story extends Didact.Component {
    constructor(props) {
        super(props);
        this.state = { likes: Math.ceil(Math.random() * 100) };
    }
    like() {
        this.setState({
            likes: this.state.likes + 1
        });
    }
    render() {
        const { name, url } = this.props;
        const { likes } = this.state;
        const likesElement = <span />;
        return (
            <li>
                <button onClick={e => this.like()}>
                    {likes}
                    <b>❤️</b>
                </button>
                <a href={url}>{name}</a>
            </li>
        );
    }
}

Didact.render(<App stories={stories} />, document.getElementById("root"));

/** ⬇️⬇️⬇️⬇️⬇️ 🌼Didact🌼 ⬇️⬇️⬇️⬇️⬇️ **/

function importFromBelow() {
    //#region element.js
    const TEXT_ELEMENT = "TEXT ELEMENT";

    function createElement(type, config, ...args) {
        const props = Object.assign({}, config);
        const hasChildren = args.length > 0;
        const rawChildren = hasChildren ? [].concat(...args) : [];
        props.children = rawChildren
            .filter(c => c != null && c !== false)
            .map(c => (c instanceof Object ? c : createTextElement(c)));
        return { type, props };
    }

    function createTextElement(value) {
        return createElement(TEXT_ELEMENT, { nodeValue: value });
    }
    //#endregion
    //#region dom-utils.js
    const isEvent = name => name.startsWith("on");
    const isAttribute = name =>
        !isEvent(name) && name != "children" && name != "style";
    const isNew = (prev, next) => key => prev[key] !== next[key];
    const isGone = (prev, next) => key => !(key in next);

    function updateDomProperties(dom, prevProps, nextProps) {
        // Remove event listeners
        Object.keys(prevProps)
            .filter(isEvent)
            .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
            .forEach(name => {
                const eventType = name.toLowerCase().substring(2);
                dom.removeEventListener(eventType, prevProps[name]);
            });

        // Remove attributes
        Object.keys(prevProps)
            .filter(isAttribute)
            .filter(isGone(prevProps, nextProps))
            .forEach(name => {
                dom[name] = null;
            });

        // Set attributes
        Object.keys(nextProps)
            .filter(isAttribute)
            .filter(isNew(prevProps, nextProps))
            .forEach(name => {
                dom[name] = nextProps[name];
            });

        // Set style
        prevProps.style = prevProps.style || {};
        nextProps.style = nextProps.style || {};
        Object.keys(nextProps.style)
            .filter(isNew(prevProps.style, nextProps.style))
            .forEach(key => {
                dom.style[key] = nextProps.style[key];
            });
        Object.keys(prevProps.style)
            .filter(isGone(prevProps.style, nextProps.style))
            .forEach(key => {
                dom.style[key] = "";
            });

        // Add event listeners
        Object.keys(nextProps)
            .filter(isEvent)
            .filter(isNew(prevProps, nextProps))
            .forEach(name => {
                const eventType = name.toLowerCase().substring(2);
                dom.addEventListener(eventType, nextProps[name]);
            });
    }

    function createDomElement(fiber) {
        const isTextElement = fiber.type === TEXT_ELEMENT;
        const dom = isTextElement
            ? document.createTextNode("")
            : document.createElement(fiber.type);
        updateDomProperties(dom, [], fiber.props);
        return dom;
    }
    //#endregion
    //#region component.js
    class Component {
        constructor(props) {
            this.props = props || {};
            this.state = this.state || {};
        }

        setState(partialState) {
            scheduleUpdate(this, partialState);
        }
    }

    function createInstance(fiber) {
        const instance = new fiber.type(fiber.props);
        instance.__fiber = fiber;
        return instance;
    }
    //#endregion
    //#region reconciler.js
    // Fiber tags
    const HOST_COMPONENT = "host";
    const CLASS_COMPONENT = "class";
    const HOST_ROOT = "root";

    // Effect tags
    const PLACEMENT = 1;
    const DELETION = 2;
    const UPDATE = 3;

    const ENOUGH_TIME = 1;

    // Global state
    const updateQueue = [];
    let nextUnitOfWork = null;
    let pendingCommit = null;

    function render(elements, containerDom) {
        updateQueue.push({
            from: HOST_ROOT,
            dom: containerDom,
            newProps: { children: elements }
        });
        
        // 브라우저가 유휴 상태일 때 코드를 실행할 수 있도록 하는 API이다.
        // 성능개선에 자주 나오는 용어 추후 확인 필요...
        requestIdleCallback(performWork);
    }

    function scheduleUpdate(instance, partialState) {
        updateQueue.push({
            from: CLASS_COMPONENT,
            instance: instance,
            // scheduleUpdate일 경우 partialState를 포함한다.
            partialState: partialState
        });
        requestIdleCallback(performWork);
    }

    function performWork(deadline) {
        workLoop(deadline);
        if (nextUnitOfWork || updateQueue.length > 0) {
            requestIdleCallback(performWork);
        }
    }

    function workLoop(deadline) {
        // root fiber를 생성
        if (!nextUnitOfWork) {
            resetNextUnitOfWork();
        }
        while (nextUnitOfWork) {
            // performUnitOfWork은 DOM을 변경시키지 않으므로 분할하는 것이 좋다.
            nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
        }
        if (pendingCommit) {
            // commitAllWork은 DOM을 변경시키므로 한번에 처리되어야 한다.
            commitAllWork(pendingCommit);
        }
    }

    // 큐 로부터 최초 업데이트를 풀링하여 시작합니다.
    function resetNextUnitOfWork() {
        const update = updateQueue.shift();
        if (!update) {
            return;
        }

        // 업데이트 페이로드에서 해당 파이버로 setState 매개 변수 복사
        if (update.partialState) {
            // 추후 컴포넌트의 render()를 호출할 때 사용할 수 있습니다.
            update.instance.__fiber.partialState = update.partialState;
        }

        // 업데이트일 경우 update.dom._rootContainerFiber에 root를 가지고 있음
        const root =
            update.from == HOST_ROOT
                ? update.dom._rootContainerFiber
                : getRoot(update.instance.__fiber);

        // 이 fiber는 새로운 작업 중(work-in-progress) 트리의 루트입니다.
        nextUnitOfWork = {
            tag: HOST_ROOT,
            stateNode: update.dom || root.stateNode,
            props: update.newProps || root.props,
            alternate: root
        };
    }

    // setState로 부터 업데이트일 경우 부모가 없는 파이버를 찾을때까지 상위로 이동
    function getRoot(fiber) {
        let node = fiber;
        while (node.parent) {
            node = node.parent;
        }
        return node;
    }

    // 작업중인 업데이트에 대한 작업 중 work-in-progress 트리를 작성하고 DOM에 적용해야 하는 변경 사항을 확인합니다
    // work-in-progress 트리의 전 node를 순회한다.
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
                // 형제 노드도 beginWork를 실행시켜준다
                return uow.sibling;
            }
            // 삼촌(형제(sibling)의 부모)의 경우도 수행한다.
            uow = uow.parent;
        }
    }

    /**
     * beginWork()는 두가지를 수행합니다.
     * 1. stateNode가 없다면 생성합니다.
     * 2. 컴포넌트 자식들을 가져와 reconcileChildrenArray()로 넘겨줍니다.
     */
    function beginWork(wipFiber) {
        // native DOM인지, 클래스형 컴포넌트인지
        if (wipFiber.tag == CLASS_COMPONENT) {
            updateClassComponent(wipFiber);
        } else {
            updateHostComponent(wipFiber);
        }
    }

    function updateHostComponent(wipFiber) {
        if (!wipFiber.stateNode) {
            // 현재 DOM이 없을 경우 DOM 생성
            wipFiber.stateNode = createDomElement(wipFiber);
        }

        const newChildElements = wipFiber.props.children;
        reconcileChildrenArray(wipFiber, newChildElements);
    }

    function updateClassComponent(wipFiber) {
        let instance = wipFiber.stateNode;
        if (instance == null) {
            // 클래스 생성자 호출
            instance = wipFiber.stateNode = createInstance(wipFiber);
        } else if (wipFiber.props == instance.props && !wipFiber.partialState) {
            // 지난번에 복제한 자식을, 랜더링 할 필요가 없습니다.
            // shouldComponentUpdate()의 간단한 버전, 다시 렌더링 할 필요 없으면 진행 중(work-in-progress) 트리에 복제(clone)한다.
            cloneChildFibers(wipFiber);
            return;
        }

        instance.props = wipFiber.props;
        instance.state = Object.assign({}, instance.state, wipFiber.partialState);
        wipFiber.partialState = null;

        // class 컴포넌트 렌더 함수 호출(createElement로 작성된 로직이 실행)
        const newChildElements = wipFiber.stateNode.render();
        reconcileChildrenArray(wipFiber, newChildElements);
    }

    function arrify(val) {
        return val == null ? [] : Array.isArray(val) ? val : [val];
    }

    // 재조정 알고리즘, 이 library의 핵심이다.
    // 리액트와는 달리 재조정을 위해 keys를 사용하지 않으므로, 이전 위치에서 벗어난 자식이 있는지 알 수 없습니다.
    function reconcileChildrenArray(wipFiber, newChildElements) {
        // newChildElements는 배열일 수 있다. 이는 render 함수가 배열을 반환할 수 있다는 의미를 가진다.
        const elements = arrify(newChildElements);

        let index = 0;
        // 기존 fiber
        let oldFiber = wipFiber.alternate ? wipFiber.alternate.child : null;
        let newFiber = null;
        while (index < elements.length || oldFiber != null) {
            const prevFiber = newFiber;
            const element = index < elements.length && elements[index];
            const sameType = oldFiber && element && element.type == oldFiber.type;

            // 기존 stateNode를 계속 사용
            if (sameType) {
                newFiber = {
                    type: oldFiber.type,
                    tag: oldFiber.tag,
                    stateNode: oldFiber.stateNode,
                    props: element.props,
                    parent: wipFiber,
                    alternate: oldFiber,
                    partialState: oldFiber.partialState,
                    // UPDATE 추가
                    effectTag: UPDATE
                };
            }

            // element에 있는 정보로 새로운 파이버를 생성
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

            // oldFiber는 있는데 element가 없을 경우 DELETION을 추가한다.
            if (oldFiber && !sameType) {
                oldFiber.effectTag = DELETION;
                wipFiber.effects = wipFiber.effects || [];
                // 작업 중(work-in-progress) 트리의 일부가 아니기 때문에, 그것을 추적할 수 없도록 wipFiber.effets 목록에 추가
                wipFiber.effects.push(oldFiber);
            }

            // element와 자식 엘리먼트를 맞춰준다
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

    // 각 wipFiber.alternate 자식들(children)을 복제하고 진행 중(work-in-progress) 트리에 추가합니다
    // 아무것도 변경하지 않아도 되므로 어떠한 effectTag도 추가할 필요가 없습니다.
    function cloneChildFibers(parentFiber) {
        const oldFiber = parentFiber.alternate;
        if (!oldFiber.child) {
            return;
        }

        let oldChild = oldFiber.child;
        let prevChild = null;
        while (oldChild) {
            const newChild = {
                type: oldChild.type,
                tag: oldChild.tag,
                stateNode: oldChild.stateNode,
                props: oldChild.props,
                partialState: oldChild.partialState,
                alternate: oldChild,
                parent: parentFiber
            };
            if (prevChild) {
                prevChild.sibling = newChild;
            } else {
                parentFiber.child = newChild;
            }
            prevChild = newChild;
            oldChild = oldChild.sibling;
        }
    }

    function completeWork(fiber) {
        if (fiber.tag == CLASS_COMPONENT) {
            // 클래스 컴포넌트의 인스턴스와 관련된 파이버에 대한 참조를 업데이트합니다.
            // 애매하지만 어디선가 해야한다.
            fiber.stateNode.__fiber = fiber;
        }

        if (fiber.parent) {
            const childEffects = fiber.effects || [];
            const thisEffect = fiber.effectTag != null ? [fiber] : [];
            const parentEffects = fiber.parent.effects || [];
            // root 노드로 모든 변경사항들을 올린다.
            fiber.parent.effects = parentEffects.concat(childEffects, thisEffect);
        } else {
            // root 노드일 경우 그대로 fiber를 pendingCommit으로 전달
            pendingCommit = fiber;
        }
    }

    // pendingCommit으로부터 effects를 받아 DOM을 변경합니다.
    function commitAllWork(fiber) {
        fiber.effects.forEach(f => {
            commitWork(f);
        });

        // 작업 진행 중(work-in-progress) 트리는 작업중인 트리가 아닌 이전 트리가 되므로 루트를 _rootContainerFiber에 할당합니다.
        fiber.stateNode._rootContainerFiber = fiber;

        // nextUnitOfWork, pendingCommit 초기화
        nextUnitOfWork = null;
        pendingCommit = null;
    }

    function commitWork(fiber) {
        if (fiber.tag == HOST_ROOT) {
            return;
        }

        let domParentFiber = fiber.parent;
        while (domParentFiber.tag == CLASS_COMPONENT) {
            domParentFiber = domParentFiber.parent;
        }
        const domParent = domParentFiber.stateNode;

        if (fiber.effectTag == PLACEMENT && fiber.tag == HOST_COMPONENT) {
            // 부모 DOM 노드를 찾은 다음 단순히 파이버의 stateNode를 추가합니다.
            domParent.appendChild(fiber.stateNode);
        } else if (fiber.effectTag == UPDATE) {
            // stateNode를 이전 props 및 새 props와 함께 전달하고 updateDomProperties()가 업데이트 할 항목을 결정하도록 합니다.
            updateDomProperties(fiber.stateNode, fiber.alternate.props, fiber.props);
        } else if (fiber.effectTag == DELETION) {
            commitDeletion(fiber, domParent);
        }
    }

    function commitDeletion(fiber, domParent) {
        let node = fiber;
        while (true) {
            // 클래스 컴포넌트인 경우 removeChild()를 호출하기 전에 파이버 하위 트리에서 모든 호스트 컴포넌트를 찾아서 제거해야 합니다.
            if (node.tag == CLASS_COMPONENT) {
                node = node.child;
                continue;
            }

            // 호스트 컴포넌트인 경우 removeChild()를 호출
            domParent.removeChild(node.stateNode);
            while (node != fiber && !node.sibling) {
                node = node.parent;
            }
            if (node == fiber) {
                return;
            }
            node = node.sibling;
        }
    }
    //#endregion
    return {
        createElement,
        render,
        Component
    };
}
