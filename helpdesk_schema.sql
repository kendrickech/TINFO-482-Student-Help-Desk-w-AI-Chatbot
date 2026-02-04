-- Create user table
CREATE TABLE user_table (
	user_id serial PRIMARY KEY,
	username varchar(255) NOT NULL,
	email varchar(255) UNIQUE NOT NULL,
	password_hash TEXT NOT NULL,
	user_role varchar(20) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Create ticket table
CREATE TABLE ticket_table (
	ticket_id serial PRIMARY KEY,
	title varchar(255) NOT NULL,
	description text NOT NULL,
	status varchar(20) NOT NULL,
	priority varchar(20) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP,

	created_by integer NOT NULL,
	assigned_to integer,

	CONSTRAINT fk_created_by 
		FOREIGN KEY (created_by) 
		REFERENCES user_table (user_id) 
		ON DELETE CASCADE,

	CONSTRAINT fk_assigned_to 
		FOREIGN KEY (assigned_to) 
		REFERENCES user_table (user_id) 
		ON DELETE SET NULL
);

-- Create ticket comment table
CREATE TABLE ticket_comment_table (
	comment_id serial PRIMARY KEY,
	message text NOT NULL,
	created_at timestamp default CURRENT_TIMESTAMP,

	ticket_id INTEGER NOT NULL,
	created_by INTEGER NOT NULL,

	CONSTRAINT fk_ticket 
		FOREIGN KEY (ticket_id) 
		REFERENCES ticket_table (ticket_id) 
		ON DELETE CASCADE,

	CONSTRAINT fk_user
		FOREIGN KEY (created_by)
		REFERENCES user_table (user_id)
		ON DELETE CASCADE
);