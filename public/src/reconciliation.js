// const rootDom = document.getElementById("root");

// function tick() {
//     const time = new Date().toLocaleTimeString();
//     const clockElement = <h1>{time}</h1>;
//     render(clockElement, rootDom);
// }

// tick();
// setInterval(tick, 1000);


/** @jsx Didact.createElement */
const Didact = importFromBelow();

const randomLikes = () => Math.ceil(Math.random() * 100);

const stories = [
    {
        name: "Didact introduction",
        url: "http://bit.ly/2pX7HNn",
        likes: randomLikes()
    },
    {
        name: "Rendering DOM elements ",
        url: "http://bit.ly/2qCOejH",
        likes: randomLikes()
    },
    {
        name: "Element creation and JSX",
        url: "http://bit.ly/2qGbw8S",
        likes: randomLikes()
    },
    {
        name: "Instances and reconciliation",
        url: "http://bit.ly/2q4A746",
        likes: randomLikes()
    },
    {
        name: "Components and state",
        url: "http://bit.ly/2rE16nh",
        likes: randomLikes()
    }
];

const appElement = () => <div><ul>{stories.map(storyElement)}</ul></div>;

function storyElement(story) {
    return (
        <li>
            <button onClick={e => handleClick(story)}>{story.likes}<b>❤️</b></button>
            <a href={story.url}>{story.name}</a>
        </li>
    );
}

function handleClick(story) {
    story.likes += 1;
    Didact.render(appElement(), document.getElementById("root"));
}

Didact.render(appElement(), document.getElementById("root"));

/** ⬇️⬇️⬇️⬇️⬇️ 🌼Didact🌼 ⬇️⬇️⬇️⬇️⬇️ **/

// DOM에 1:1로 매핑되는 인스턴스 생성
// 비교 후 업데이트
function importFromBelow() {
    const TEXT_ELEMENT = "TEXT ELEMENT";
    let rootInstance = null;

    function render(element, container) {
        const prevInstance = rootInstance;
        const nextInstance = reconcile(container, prevInstance, element);
        rootInstance = nextInstance;
    }

    // 가능한 인스턴스를 만들거나 제거하지 않는 것이 목표
    // 인스턴스를 제거한다는 것은 DOM 트리도 수정한다는 것을 의미
    // 인스턴스를 더 많이 사용할수록 DOM 트리를 덜 수정하게 된다.
    function reconcile(parentDom, instance, element) {
        // 새로운 인스턴스를 생성하거나, 기존 인스턴스를 반환
        if (instance == null) {
            // Create instance
            const newInstance = instantiate(element);
            parentDom.appendChild(newInstance.dom);
            return newInstance;
        } else if (element == null) {
            // Remove instance
            parentDom.removeChild(instance.dom);
            return null;
        } else if (instance.element.type === element.type) {
            // type을 비교하여 재사용 여부 결정
            // Update instance
            updateDomProperties(instance.dom, instance.element.props, element.props);
            instance.childInstances = reconcileChildren(instance, element);
            instance.element = element;
            return instance;
        } else {
            // Replace instance
            const newInstance = instantiate(element);
            parentDom.replaceChild(newInstance.dom, instance.dom);
            return newInstance;
        }
    }

    function reconcileChildren(instance, element) {
        const dom = instance.dom;
        const childInstances = instance.childInstances;
        const nextChildElements = element.props.children || [];
        const newChildInstances = [];
        const count = Math.max(childInstances.length, nextChildElements.length);
        for (let i = 0; i < count; i++) {
            const childInstance = childInstances[i];
            const childElement = nextChildElements[i];
            const newChildInstance = reconcile(dom, childInstance, childElement);
            newChildInstances.push(newChildInstance);
        }
        return newChildInstances.filter(instance => instance != null);
    }

    function instantiate(element) {
        const { type, props } = element;

        // Create DOM element
        const isTextElement = type === "TEXT ELEMENT";
        const dom = isTextElement
            ? document.createTextNode("")
            : document.createElement(type);

        updateDomProperties(dom, [], props);

        // Instantiate and append children
        const childElements = props.children || [];
        const childInstances = childElements.map(instantiate);
        const childDoms = childInstances.map(childInstance => childInstance.dom);
        childDoms.forEach(childDom => dom.appendChild(childDom));

        // 마지막으로 호출된 .render의 instance를 저장한다.
        const instance = { dom, element, childInstances };
        return instance;
    }

    function updateDomProperties(dom, prevProps, nextProps) {
        const isEvent = name => name.startsWith("on");
        const isAttribute = name => !isEvent(name) && name != "children";

        // Remove event listeners
        Object.keys(prevProps).filter(isEvent).forEach(name => {
            const eventType = name.toLowerCase().substring(2);
            dom.removeEventListener(eventType, prevProps[name]);
        });

        // Remove attributes
        Object.keys(prevProps).filter(isAttribute).forEach(name => {
            dom[name] = null;
        });

        // Set attributes
        Object.keys(nextProps).filter(isAttribute).forEach(name => {
            dom[name] = nextProps[name];
        });

        // Add event listeners
        Object.keys(nextProps).filter(isEvent).forEach(name => {
            const eventType = name.toLowerCase().substring(2);
            dom.addEventListener(eventType, nextProps[name]);
        });
    }

    function createElement(type, config, ...args) {
        const props = Object.assign({}, config);
        const hasChildren = args.length > 0;
        const rawChildren = hasChildren ? [].concat(...args) : [];
        props.children = rawChildren
            .filter(c => c != null && c !== false)
            .map(c => c instanceof Object ? c : createTextElement(c));
        return { type, props };
    }

    function createTextElement(value) {
        return createElement(TEXT_ELEMENT, { nodeValue: value });
    }

    return {
        render,
        createElement
    };
}
