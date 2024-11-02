interface Props {
  containerId: string;
  height: string;
  columns?: number;
  onNavigateOffFinalPage?: () => void | Promise<void>;
}

function createBookView({
  containerId,
  height,
  columns = 2,
  onNavigateOffFinalPage = () => {},
}: Props) {
  const container = document.getElementById(containerId);

  container.style.height = height;
  container.style.columnCount = columns + "";
  container.style.columnGap = "1rem";

  if (container == null) {
    throw Error("Could not find container with ID " + containerId);
  }

  if (columns < 1) {
    throw Error("Invalid column count " + columns);
  }

  function containerClickHandler(event: MouseEvent) {
    let bounds = container.getBoundingClientRect();
    let x = event.clientX - bounds.left;
    let y = event.clientY - bounds.top;

    const percentWidth = (x / container.offsetWidth) * 100;

    if (percentWidth < 20.0) {
    }

    if (percentWidth > 80.0) {
    }
  }

  function containerKeyboardHandler(event: KeyboardEvent) {}

  return () => {
    container.removeEventListener("click", containerClickHandler);
    container.removeEventListener("keyup", containerKeyboardHandler);
  };
}
