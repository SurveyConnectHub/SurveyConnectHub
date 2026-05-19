export type UserRole = "client" | "professional";
export type VerificationStatus = "pending" | "verified" | "rejected";
export type ContractStatus = "pending" | "active" | "completed";
export type JobStatus = "open" | "in_progress" | "closed";
export type ApplicationStatus = "pending" | "accepted" | "rejected";
export type BudgetType = "fixed" | "hourly";

export interface Profile {
	id: string;
	role: UserRole;
	full_name: string | null;
	email: string | null;
	phone: string | null;
	country: string | null;
	city: string | null;
	bio: string | null;
	is_admin: boolean;
	bank_name: string | null;
	bank_account_number: string | null;
	bank_account_name: string | null;
	paystack_recipient_code: string | null;
	notification_email: boolean;
	notification_messages: boolean;
	notification_marketing: boolean;
	created_at: string;
}

export interface ProfessionalProfile {
	id: string;
	profession_type: string;
	secondary_profession: string | null;
	license_number: string | null;
	years_experience: number;
	id_document_url: string | null;
	license_url: string | null;
	verification_status: VerificationStatus;
	onboarding_completed: boolean;
	onboarding_step: string;
	onboarding_completed_at: string | null;
	created_at: string;
}

export interface Job {
	id: string;
	client_id: string;
	title: string;
	description: string;
	profession_type: string;
	budget: number;
	budget_type: BudgetType;
	job_type: string;
	location: string | null;
	required_skills: string[];
	estimated_duration: string | null;
	brief_attachment_url: string | null;
	required_verification: boolean;
	status: JobStatus;
	applications_count: number;
	experience_level: string | null;
	budget_model: string | null;
	budget_min: number | null;
	budget_max: number | null;
	screening_questions: string[] | null;
	created_at: string;
}

export interface Contract {
	id: string;
	job_id: string;
	client_id: string;
	professional_id: string;
	application_id: string;
	agreed_budget: number;
	escrow_amount: number;
	status: ContractStatus;
	start_date: string | null;
	payment_reference: string | null;
	payment_released_at: string | null;
	professional_receives: number | null;
	platform_fee: number | null;
	ngn_amount_paid: number | null;
	exchange_rate_used: number | null;
	created_at: string;
}

export interface JobApplication {
	id: string;
	job_id: string;
	professional_id: string;
	cover_letter: string;
	proposed_rate: number;
	estimated_delivery: string | null;
	relevant_experience: string | null;
	questions_for_client: string | null;
	portfolio_item_id: string | null;
	portfolio_attachment_url: string | null;
	status: ApplicationStatus;
	screening_answers: string[] | null;
	created_at: string;
}

export interface PortfolioItem {
	id: string;
	professional_id: string;
	title: string | null;
	file_url: string;
	created_at: string;
}

export interface Notification {
	id: string;
	user_id: string;
	title: string | null;
	message: string | null;
	type: string | null;
	link: string | null;
	is_read: boolean;
	read_at: string | null;
	created_at: string;
}

export interface Review {
	id: string;
	contract_id: string;
	reviewer_id: string;
	reviewee_id: string;
	rating: number;
	comment: string | null;
	created_at: string;
}
