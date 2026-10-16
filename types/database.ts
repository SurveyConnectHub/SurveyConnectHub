export type UserRole = "client" | "professional";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type ContractStatus = "pending" | "active" | "completed" | "disputed" | "cancelled";
export type JobStatus = "open" | "in_progress" | "completed" | "cancelled";
export type ApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";
export type BudgetType = "fixed" | "hourly";
export type ProfessionType = "land_surveyor" | "gis_analyst" | "drone_pilot" | "cartographer" | "photogrammetrist" | "lidar_specialist" | "remote_sensing_analyst" | "urban_planner" | "spatial_data_scientist" | "hydrographic_surveyor" | "mining_surveyor" | "construction_surveyor" | "environmental_analyst" | "bim_specialist" | "other";
export type NotificationType = "application" | "contract" | "message" | "payment" | "review" | "verification";
export type MilestoneStatus = "pending" | "funded" | "submitted" | "approved" | "disputed" | "released";
export type TransactionType = "escrow_deposit" | "milestone_release" | "refund" | "platform_fee";
export type PricingModel = "flat" | "hectare" | "km" | "point" | "polygon" | "acre";

export interface ExchangeRateOverride {
  id: string;
  rate: number;
  set_by: string;
  created_at: string;
}

export interface Profile {
	id: string;
	role: UserRole;
	full_name: string;
	username: string | null;
	email: string;
	phone: string | null;
	country: string | null;
	city: string | null;
	bio: string | null;
	avatar_url: string | null;
	is_active: boolean;
	is_admin: boolean;
	bank_name: string | null;
	bank_account_number: string | null;
	bank_account_name: string | null;
	paystack_recipient_code: string | null;
	notification_email: boolean;
	notification_messages: boolean;
	notification_marketing: boolean;
	is_deleted: boolean;
	deleted_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface ProfessionalProfile {
	id: string;
	profession_type: ProfessionType;
	secondary_profession: ProfessionType | null;
	years_experience: number | null;
	skills: string[];
	certifications: string[];
	license_number: string | null;
	license_url: string | null;
	id_document_url: string | null;
	verification_status: VerificationStatus;
	verification_notes: string | null;
	verified_at: string | null;
	hourly_rate: number | null;
	portfolio_description: string | null;
	total_jobs_completed: number;
	total_earned: number;
	average_rating: number;
	total_reviews: number;
	software_tools: string[];
	survey_equipment: string[];
	delivery_formats: string[];
	job_types_supported: string[];
	primary_disciplines: string[];
	accreditations: Record<string, string>;
	service_area_geo: string | null;
	service_area_radius_km: number | null;
	service_area_label: string | null;
	onboarding_completed: boolean;
	onboarding_step: string;
	onboarding_completed_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface Job {
	id: string;
	client_id: string;
	title: string;
	description: string;
	profession_type: ProfessionType;
	budget: number;
	budget_type: string;
	job_type: string;
	location_country: string | null;
	location_city: string | null;
	is_remote: boolean;
	location: string | null;
	required_skills: string[];
	estimated_duration: string | null;
	brief_attachment_url: string | null;
	attachments: string[];
	required_verification: boolean;
	status: JobStatus;
	experience_level: string | null;
	budget_model: string;
	budget_min: number | null;
	budget_max: number | null;
	screening_questions: string[] | null;
	pricing_model: PricingModel;
	pricing_unit_rate: number | null;
	pricing_quantity: number | null;
	pricing_unit: string | null;
	mobilization_fee: number;
	accuracy_class: string | null;
	applications_count: number;
	created_at: string;
	updated_at: string;
}

export interface Contract {
	id: string;
	job_id: string;
	client_id: string;
	professional_id: string;
	application_id: string | null;
	agreed_budget: number;
	platform_fee: number | null;
	professional_receives: number | null;
	escrow_amount: number;
	status: ContractStatus;
	start_date: string;
	end_date: string | null;
	payment_reference: string | null;
	payment_released_at: string | null;
	ngn_amount_paid: number | null;
	exchange_rate_used: number | null;
	is_milestone_based: boolean;
	milestones_total_amount: number | null;
	created_at: string;
	updated_at: string;
}

export interface JobApplication {
	id: string;
	job_id: string;
	professional_id: string;
	cover_letter: string;
	proposed_rate: number;
	estimated_duration: string | null;
	estimated_delivery: string | null;
	relevant_experience: string | null;
	questions_for_client: string | null;
	portfolio_item_id: string | null;
	portfolio_attachment_url: string | null;
	status: ApplicationStatus;
	screening_answers: string[] | null;
	client_notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface PortfolioItem {
	id: string;
	professional_id: string;
	title: string;
	description: string | null;
	profession_type: ProfessionType | null;
	project_type: string | null;
	data_sources: string | null;
	crs: string | null;
	scale_resolution: string | null;
	software_used: string[];
	image_urls: string[];
	completion_date: string | null;
	client_name: string | null;
	file_url: string;
	preview_image_url: string;
	map_embed_html: string | null;
	created_at: string;
	updated_at: string;
}

export interface Notification {
	id: string;
	user_id: string;
	type: NotificationType;
	title: string;
	message: string;
	is_read: boolean;
	related_job_id: string | null;
	related_contract_id: string | null;
	related_application_id: string | null;
	link: string | null;
	read_at: string | null;
	created_at: string;
}

export interface Message {
	id: string;
	contract_id: string;
	sender_id: string;
	content: string;
	attachment_url: string | null;
	attachment_type: string | null;
	attachment_name: string | null;
	attachment_size: number | null;
	is_read: boolean;
	read_at: string | null;
	created_at: string;
}

export interface ClientProfile {
	id: string;
	company_website: string | null;
	industry: string | null;
	total_jobs_posted: number;
	total_spent: number;
	onboarding_dismissed_at: string | null;
	created_at: string;
	updated_at: string;
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

export interface Milestone {
	id: string;
	contract_id: string;
	title: string;
	description: string | null;
	amount: number;
	status: MilestoneStatus;
	due_date: string | null;
	deliverables_description: string | null;
	deliverables_url: string[];
	funded_at: string | null;
	submitted_at: string | null;
	approved_at: string | null;
	released_at: string | null;
	funded_reference: string | null;
	paystack_payment_reference: string | null;
	paystack_transfer_reference: string | null;
	created_at: string;
	updated_at: string;
}

export interface SavedJob {
	id: string;
	user_id: string;
	job_id: string;
	created_at: string;
}

export interface Transaction {
	id: string;
	contract_id: string;
	milestone_id: string | null;
	type: TransactionType;
	amount: number;
	platform_fee: number;
	status: string;
	paystack_reference: string | null;
	paystack_transfer_reference: string | null;
	created_at: string;
}

export type ContractReportStatus = "open" | "resolved" | "dismissed";

export interface ContractReport {
	id: string;
	contract_id: string;
	reporter_id: string;
	reason: string;
	details: string | null;
	status: ContractReportStatus;
	created_at: string;
}

export interface AdminAction {
	id: string;
	admin_id: string;
	action: string;
	contract_id: string | null;
	details: Record<string, unknown> | null;
	created_at: string;
}
