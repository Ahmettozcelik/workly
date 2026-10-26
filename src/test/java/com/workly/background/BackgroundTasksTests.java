package com.workly.background;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class BackgroundTasksTests {

	private final List<Runnable> queued = new ArrayList<>();
	private final BackgroundTasks background = new BackgroundTasks(queued::add);

	@Test
	void runReturnsBeforeTheTaskRuns() {
		List<String> done = new ArrayList<>();
		background.run("Task", () -> done.add("ran"));
		assertThat(done).isEmpty();

		queued.forEach(Runnable::run);
		assertThat(done).containsExactly("ran");
	}

	@Test
	void aFailedTaskIsLoggedNotThrown() {
		background.run("Task", () -> {
			throw new IllegalStateException("member@example.com");
		});
		assertThatNoException().isThrownBy(() -> queued.forEach(Runnable::run));
	}
}
