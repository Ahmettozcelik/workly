package com.workly.background;

import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

/**
 * Work that must not hold up a request (Boot's applicationTaskExecutor): mails,
 * and steps whose duration would reveal whether an account exists. A failure is
 * logged with the exception type only, since its text may name a member or an
 * address. The queue is in memory: tasks still waiting at shutdown are lost.
 */
@Component
public class BackgroundTasks {

	private static final Logger log = LoggerFactory.getLogger(BackgroundTasks.class);

	private final Executor executor;

	public BackgroundTasks(@Qualifier("applicationTaskExecutor") Executor executor) {
		this.executor = executor;
	}

	/** Runs the task later; what describes it (e.g. "Mail") goes into the failure log. */
	public void run(String description, Runnable task) {
		executor.execute(() -> {
			try {
				task.run();
			}
			catch (RuntimeException ex) {
				log.warn("{} failed ({})", description, ex.getClass().getSimpleName());
			}
		});
	}
}
