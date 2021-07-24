--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

CREATE TABLE `library_applications` (
  `id` INTEGER PRIMARY KEY NOT NULL,
  `key` VARCHAR(64) UNIQUE NOT NULL,
  `title` VARCHAR(128) NOT NULL,
  `tags` VARCHAR(191),
  `description` VARCHAR(512),
  `cost` DECIMAL(5,2) DEFAULT 0.00
);

--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------

DROP TABLE `library_applications`;